import { createFileRoute } from "@tanstack/react-router";
import { computeSignal, type Candle, type SymbolMeta } from "@/lib/signals";

interface SymbolDef extends SymbolMeta {
  twelve: string;
}

const SYMBOLS: SymbolDef[] = [
  { id: "EURUSD", stooq: "EURUSD=X", twelve: "EUR/USD", name: "Euro / US Dollar", category: "Forex", decimals: 5, pip: 0.0001 },
  { id: "GBPUSD", stooq: "GBPUSD=X", twelve: "GBP/USD", name: "Pound / US Dollar", category: "Forex", decimals: 5, pip: 0.0001 },
  { id: "USDJPY", stooq: "JPY=X", twelve: "USD/JPY", name: "US Dollar / Yen", category: "Forex", decimals: 3, pip: 0.01 },
  { id: "XAUUSD", stooq: "GC=F", twelve: "XAU/USD", name: "Gold / US Dollar", category: "Commodities", decimals: 2, pip: 0.1 },
  { id: "XAGUSD", stooq: "SI=F", twelve: "XAG/USD", name: "Silver / US Dollar", category: "Commodities", decimals: 3, pip: 0.01 },
  { id: "BTCUSD", stooq: "BTC-USD", twelve: "BTC/USD", name: "Bitcoin", category: "Crypto", decimals: 0, pip: 1 },
  { id: "ETHUSD", stooq: "ETH-USD", twelve: "ETH/USD", name: "Ethereum", category: "Crypto", decimals: 2, pip: 0.1 },
  { id: "US500", stooq: "^GSPC", twelve: "SPX", name: "S&P 500 Index", category: "Indices", decimals: 2, pip: 1 },
  { id: "NAS100", stooq: "^NDX", twelve: "NDX", name: "Nasdaq 100 Index", category: "Indices", decimals: 2, pip: 1 },
];

// --- Twelve Data (fresher intraday data) with in-memory cache ---

const CACHE_TTL_MS = 5 * 60_000;
const cache = new Map<string, { at: number; candles: Candle[] }>();

interface TwelveValue {
  datetime: string;
  open: string;
  high: string;
  low: string;
  close: string;
}

async function fetchTwelveCandles(symbol: string, interval: string, apiKey: string): Promise<Candle[]> {
  const cacheKey = `${symbol}:${interval}`;
  const hit = cache.get(cacheKey);
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.candles;

  const url = `https://api.twelvedata.com/time_series?symbol=${encodeURIComponent(symbol)}&interval=${interval}&outputsize=400&timezone=UTC&apikey=${apiKey}`;
  const res = await fetch(url);
  if (!res.ok) return hit?.candles ?? [];
  const json = (await res.json()) as { status?: string; values?: TwelveValue[] };
  if (json.status !== "ok" || !json.values?.length) return hit?.candles ?? [];

  const candles: Candle[] = json.values
    .map((v) => {
      const t = new Date(v.datetime.replace(" ", "T") + "Z").getTime();
      return { t, time: new Date(t).toISOString(), open: +v.open, high: +v.high, low: +v.low, close: +v.close };
    })
    .filter((c) => Number.isFinite(c.t) && Number.isFinite(c.close))
    .reverse();

  if (candles.length) cache.set(cacheKey, { at: Date.now(), candles });
  return candles.length ? candles : (hit?.candles ?? []);
}

// --- Yahoo fallback ---

interface YahooQuote {
  open: (number | null)[];
  high: (number | null)[];
  low: (number | null)[];
  close: (number | null)[];
}

async function fetchYahooCandles(yahooSymbol: string, interval: string, range: string): Promise<Candle[]> {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(yahooSymbol)}?range=${range}&interval=${interval}`;
  const res = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0" } });
  if (!res.ok) return [];
  const json = (await res.json()) as {
    chart?: { result?: { timestamp?: number[]; indicators?: { quote?: YahooQuote[] } }[] };
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
    candles.push({ t: t * 1000, time: new Date(t * 1000).toISOString(), open: o, high: h, low: l, close: c });
  }
  return candles;
}

async function fetchSymbolCandles(meta: SymbolDef, apiKey: string | undefined) {
  if (apiKey) {
    const [h1, m15, m5] = await Promise.all([
      fetchTwelveCandles(meta.twelve, "1h", apiKey),
      fetchTwelveCandles(meta.twelve, "15min", apiKey),
      fetchTwelveCandles(meta.twelve, "5min", apiKey),
    ]);
    if (h1.length && m15.length && m5.length) return { h1, m15, m5 };
  }
  const [h1, m15, m5] = await Promise.all([
    fetchYahooCandles(meta.stooq, "60m", "1mo"),
    fetchYahooCandles(meta.stooq, "15m", "5d"),
    fetchYahooCandles(meta.stooq, "5m", "5d"),
  ]);
  return { h1, m15, m5 };
}

export const Route = createFileRoute("/api/public/quotes")({
  server: {
    handlers: {
      GET: async () => {
        const apiKey = process.env["TWELVE_DATA_API_KEY"];
        const results = await Promise.all(
          SYMBOLS.map(async (meta) => {
            try {
              const { h1, m15, m5 } = await fetchSymbolCandles(meta, apiKey);
              return computeSignal(meta, h1, m15, m5);
            } catch {
              return null;
            }
          }),
        );
        const signals = results.filter((s) => s !== null);
        return Response.json(
          { signals, generatedAt: new Date().toISOString() },
          { headers: { "Cache-Control": "public, max-age=60" } },
        );
      },
    },
  },
});
