import { createFileRoute } from "@tanstack/react-router";
import { computeSignal, type Candle, type SymbolMeta } from "@/lib/signals";

const SYMBOLS: SymbolMeta[] = [
  { id: "EURUSD", stooq: "EURUSD=X", name: "Euro / US Dollar", category: "Forex", decimals: 5 },
  { id: "GBPUSD", stooq: "GBPUSD=X", name: "Pound / US Dollar", category: "Forex", decimals: 5 },
  { id: "USDJPY", stooq: "JPY=X", name: "US Dollar / Yen", category: "Forex", decimals: 3 },
  { id: "XAUUSD", stooq: "GC=F", name: "Gold Futures", category: "Commodities", decimals: 2 },
  { id: "XAGUSD", stooq: "SI=F", name: "Silver Futures", category: "Commodities", decimals: 3 },
  { id: "BTCUSD", stooq: "BTC-USD", name: "Bitcoin", category: "Crypto", decimals: 0 },
  { id: "ETHUSD", stooq: "ETH-USD", name: "Ethereum", category: "Crypto", decimals: 2 },
  { id: "US500", stooq: "^GSPC", name: "S&P 500 Index", category: "Indices", decimals: 2 },
  { id: "NAS100", stooq: "^NDX", name: "Nasdaq 100 Index", category: "Indices", decimals: 2 },
];

interface YahooQuote {
  open: (number | null)[];
  high: (number | null)[];
  low: (number | null)[];
  close: (number | null)[];
}

async function fetchDailyCandles(yahooSymbol: string): Promise<Candle[]> {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(yahooSymbol)}?range=6mo&interval=1d`;
  const res = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0" } });
  if (!res.ok) return [];
  const json = (await res.json()) as {
    chart?: {
      result?: {
        timestamp?: number[];
        indicators?: { quote?: YahooQuote[] };
      }[];
    };
  };
  const result = json.chart?.result?.[0];
  const timestamps = result?.timestamp ?? [];
  const quote = result?.indicators?.quote?.[0];
  if (!quote) return [];

  const candles: Candle[] = [];
  for (let i = 0; i < timestamps.length; i++) {
    const o = quote.open[i];
    const h = quote.high[i];
    const l = quote.low[i];
    const c = quote.close[i];
    const t = timestamps[i];
    if (o == null || h == null || l == null || c == null || t == null) continue;
    candles.push({
      time: new Date(t * 1000).toISOString().slice(0, 10),
      open: o,
      high: h,
      low: l,
      close: c,
    });
  }
  return candles;
}

export const Route = createFileRoute("/api/public/quotes")({
  server: {
    handlers: {
      GET: async () => {
        const results = await Promise.all(
          SYMBOLS.map(async (meta) => {
            try {
              const candles = await fetchDailyCandles(meta.stooq);
              return computeSignal(meta, candles);
            } catch {
              return null;
            }
          }),
        );
        const signals = results.filter((s) => s !== null);
        return Response.json(
          { signals, generatedAt: new Date().toISOString() },
          { headers: { "Cache-Control": "public, max-age=300" } },
        );
      },
    },
  },
});
