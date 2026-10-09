import { createFileRoute } from "@tanstack/react-router";
import { computeSignal, type Candle, type SymbolMeta } from "@/lib/signals";

const SYMBOLS: SymbolMeta[] = [
  { id: "EURUSD", stooq: "eurusd", name: "Euro / US Dollar", category: "Forex", decimals: 5 },
  { id: "GBPUSD", stooq: "gbpusd", name: "Pound / US Dollar", category: "Forex", decimals: 5 },
  { id: "USDJPY", stooq: "usdjpy", name: "US Dollar / Yen", category: "Forex", decimals: 3 },
  { id: "XAUUSD", stooq: "xauusd", name: "Gold Spot", category: "Commodities", decimals: 2 },
  { id: "XAGUSD", stooq: "xagusd", name: "Silver Spot", category: "Commodities", decimals: 3 },
  { id: "BTCUSD", stooq: "btcusd", name: "Bitcoin", category: "Crypto", decimals: 0 },
  { id: "ETHUSD", stooq: "ethusd", name: "Ethereum", category: "Crypto", decimals: 2 },
  { id: "US500", stooq: "^spx", name: "S&P 500 Index", category: "Indices", decimals: 2 },
  { id: "NAS100", stooq: "^ndq", name: "Nasdaq 100 Index", category: "Indices", decimals: 2 },
];

async function fetchDailyCandles(stooqSymbol: string): Promise<Candle[]> {
  const res = await fetch(`https://stooq.com/q/d/l/?s=${encodeURIComponent(stooqSymbol)}&i=d`, {
    headers: { "User-Agent": "Mozilla/5.0" },
  });
  if (!res.ok) return [];
  const text = await res.text();
  const lines = text.trim().split("\n");
  if (lines.length < 2) return [];
  const candles: Candle[] = [];
  for (const line of lines.slice(1)) {
    const [date, open, high, low, close] = line.split(",");
    const o = Number(open);
    const h = Number(high);
    const l = Number(low);
    const c = Number(close);
    if (!date || [o, h, l, c].some((v) => !Number.isFinite(v))) continue;
    candles.push({ time: date, open: o, high: h, low: l, close: c });
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
