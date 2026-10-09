export interface Candle {
  time: string;
  open: number;
  high: number;
  low: number;
  close: number;
}

export interface SymbolMeta {
  id: string;
  stooq: string;
  name: string;
  category: "Forex" | "Crypto" | "Commodities" | "Indices";
  decimals: number;
}

export interface Signal {
  id: string;
  symbol: string;
  name: string;
  category: SymbolMeta["category"];
  decimals: number;
  direction: "buy" | "sell";
  price: number;
  changePct: number;
  entry: number;
  tp1: number;
  tp2: number;
  sl: number;
  confidence: number;
  candles: Candle[];
  analysis: string[];
  generatedAt: string;
}

function sma(values: number[], period: number): number {
  if (values.length < period) return values[values.length - 1] ?? 0;
  const slice = values.slice(-period);
  return slice.reduce((a, b) => a + b, 0) / period;
}

function atr(candles: Candle[], period = 14): number {
  if (candles.length < period + 1) return 0;
  let sum = 0;
  for (let i = candles.length - period; i < candles.length; i++) {
    const c = candles[i]!;
    const prev = candles[i - 1]!;
    const tr = Math.max(
      c.high - c.low,
      Math.abs(c.high - prev.close),
      Math.abs(c.low - prev.close),
    );
    sum += tr;
  }
  return sum / period;
}

function rsi(closes: number[], period = 14): number {
  if (closes.length < period + 1) return 50;
  let gains = 0;
  let losses = 0;
  for (let i = closes.length - period; i < closes.length; i++) {
    const diff = closes[i]! - closes[i - 1]!;
    if (diff >= 0) gains += diff;
    else losses -= diff;
  }
  if (losses === 0) return 100;
  const rs = gains / losses;
  return 100 - 100 / (1 + rs);
}

const round = (v: number, d: number) => {
  const p = 10 ** d;
  return Math.round(v * p) / p;
};

export function computeSignal(meta: SymbolMeta, candles: Candle[]): Signal | null {
  if (candles.length < 30) return null;
  const closes = candles.map((c) => c.close);
  const price = closes[closes.length - 1]!;
  const prevClose = closes[closes.length - 2]!;
  const changePct = prevClose ? ((price - prevClose) / prevClose) * 100 : 0;

  const sma20 = sma(closes, 20);
  const sma50 = sma(closes, 50);
  const atr14 = atr(candles);
  const rsi14 = rsi(closes);

  const direction: "buy" | "sell" = price >= sma20 ? "buy" : "sell";
  const sign = direction === "buy" ? 1 : -1;

  const entry = price;
  const tp1 = round(entry + sign * atr14 * 1.2, meta.decimals);
  const tp2 = round(entry + sign * atr14 * 2.4, meta.decimals);
  const sl = round(entry - sign * atr14 * 1.5, meta.decimals);

  const trendGap = sma20 !== 0 ? Math.abs(sma20 - sma50) / sma20 : 0;
  const momentum = Math.abs(rsi14 - 50) / 50;
  const confidence = Math.round(
    Math.min(93, Math.max(55, 58 + trendGap * 900 + momentum * 22)),
  );

  const trendWord =
    direction === "buy" ? "bullish" : "bearish";
  const smaAlign =
    (direction === "buy" && sma20 > sma50) || (direction === "sell" && sma20 < sma50)
      ? `The 20-day average sits ${direction === "buy" ? "above" : "below"} the 50-day average, confirming a ${trendWord} structure on the daily timeframe.`
      : `The 20-day and 50-day averages are converging, suggesting the ${trendWord} move is still in an early stage.`;
  const rsiWord =
    rsi14 > 70
      ? "RSI is in overbought territory, so entries should be scaled in rather than chased."
      : rsi14 < 30
        ? "RSI is in oversold territory, which increases the chance of a sharp counter-move."
        : `RSI at ${rsi14.toFixed(0)} shows ${momentum > 0.3 ? "healthy" : "moderate"} momentum with room before exhaustion.`;

  const analysis = [
    `${meta.name} (${meta.id}) is currently trading at ${price.toFixed(meta.decimals)}, ${changePct >= 0 ? "up" : "down"} ${Math.abs(changePct).toFixed(2)}% on the day. Price is holding ${direction === "buy" ? "above" : "below"} its 20-day average, which keeps the short-term bias ${trendWord}.`,
    smaAlign,
    `${rsiWord} Average true range over the last 14 sessions is ${atr14.toFixed(meta.decimals)}, which is what the take-profit and stop-loss distances are calibrated against.`,
    `The model issues a ${direction.toUpperCase()} signal with ${confidence}% confidence. First target sits at ${tp1.toFixed(meta.decimals)}, the extended target at ${tp2.toFixed(meta.decimals)}, and the invalidation level at ${sl.toFixed(meta.decimals)}. A daily close beyond the invalidation level cancels the setup.`,
    `Risk note: position sizing should assume the full stop-loss distance can be hit. This signal is generated from end-of-day data and is not financial advice.`,
  ];

  return {
    id: meta.id,
    symbol: meta.id,
    name: meta.name,
    category: meta.category,
    decimals: meta.decimals,
    direction,
    price: round(price, meta.decimals),
    changePct: round(changePct, 2),
    entry: round(entry, meta.decimals),
    tp1,
    tp2,
    sl,
    confidence,
    candles: candles.slice(-70),
    analysis,
    generatedAt: new Date().toISOString(),
  };
}
