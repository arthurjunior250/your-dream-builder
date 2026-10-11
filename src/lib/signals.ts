// Scalping signal engine: 1H trend -> 15M point of interest (POI) -> 5M sniper entry.
// Fully rule-based (no AI model involved).

export interface Candle {
  t: number; // ms epoch
  time: string; // ISO
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
  pip: number;
}

export const MAX_SL_PIPS = 100;
export const MIN_SL_PIPS = 5;
export const ENTRY_WINDOW_MIN = 15;

export interface Trade {
  direction: "buy" | "sell";
  entry: number;
  sl: number;
  tp1: number;
  tp2: number;
  riskPips: number;
  activatedAt: string;
  validUntil: string;
  tp1Hit: boolean;
  tp1HitAt: string | null;
  runningPips: number;
  slMovedToEntry: boolean;
}

export type EventKind = "entry" | "tp1" | "tp_all" | "sl" | "breakeven" | "info";

export interface HistoryEvent {
  time: string;
  kind: EventKind;
  text: string;
  pips?: number;
}

export interface Signal {
  id: string;
  symbol: string;
  name: string;
  category: SymbolMeta["category"];
  decimals: number;
  pip: number;
  price: number;
  changePct: number;
  trend: "bullish" | "bearish";
  poi: { top: number; bottom: number; time: string } | null;
  trade: Trade | null;
  waitingReason: string;
  lastResult: HistoryEvent | null;
  confidence: number;
  candles: Candle[];
  history: HistoryEvent[];
  stats: { wins: number; losses: number; netPips: number };
  analysis: string[];
  generatedAt: string;
}

function emaSeries(values: number[], period: number): number[] {
  const k = 2 / (period + 1);
  const out: number[] = [];
  values.forEach((v, i) => out.push(i === 0 ? v : v * k + out[i - 1]! * (1 - k)));
  return out;
}

const round = (v: number, d: number) => Math.round(v * 10 ** d) / 10 ** d;
const r1 = (v: number) => Math.round(v * 10) / 10;

interface Poi {
  top: number;
  bottom: number;
  t: number; // time the swing candle opened
  confirmedAt: number; // time the swing became visible
  type: "demand" | "supply";
}

function findPois(c15: Candle[]): Poi[] {
  const pois: Poi[] = [];
  for (let i = 2; i < c15.length - 2; i++) {
    const c = c15[i]!;
    const conf = c15[i + 2]!.t + 15 * 60_000;
    if (c.low < c15[i - 1]!.low && c.low < c15[i - 2]!.low && c.low <= c15[i + 1]!.low && c.low <= c15[i + 2]!.low) {
      pois.push({ type: "demand", bottom: c.low, top: Math.min(c.open, c.close), t: c.t, confirmedAt: conf });
    }
    if (c.high > c15[i - 1]!.high && c.high > c15[i - 2]!.high && c.high >= c15[i + 1]!.high && c.high >= c15[i + 2]!.high) {
      pois.push({ type: "supply", top: c.high, bottom: Math.max(c.open, c.close), t: c.t, confirmedAt: conf });
    }
  }
  return pois;
}

export function computeSignal(meta: SymbolMeta, c1h: Candle[], c15: Candle[], c5: Candle[]): Signal | null {
  if (c1h.length < 60 || c15.length < 30 || c5.length < 60) return null;
  const { pip, decimals } = meta;
  const fmt = (v: number) => v.toFixed(decimals);
  const iso = (t: number) => new Date(t).toISOString();

  const e20 = emaSeries(c1h.map((c) => c.close), 20);
  const e50 = emaSeries(c1h.map((c) => c.close), 50);
  const trendAt = (t: number): "bullish" | "bearish" => {
    let idx = -1;
    for (let i = 0; i < c1h.length; i++) if (c1h[i]!.t + 3_600_000 <= t) idx = i;
    if (idx < 0) idx = 0;
    return e20[idx]! >= e50[idx]! ? "bullish" : "bearish";
  };

  const pois = findPois(c15);
  const used = new Set<number>();
  const activePoi = (t: number, trend: "bullish" | "bearish", price: number): Poi | null => {
    const type = trend === "bullish" ? "demand" : "supply";
    const cands = pois.filter(
      (p) =>
        p.type === type &&
        p.confirmedAt <= t &&
        t - p.t < 24 * 3_600_000 &&
        !used.has(p.t) &&
        (type === "demand" ? p.bottom < price : p.top > price),
    );
    return cands.length ? cands[cands.length - 1]! : null;
  };

  const history: HistoryEvent[] = [];
  let trade: Trade | null = null;
  let lastTrend: "bullish" | "bearish" | null = null;
  const stats = { wins: 0, losses: 0, netPips: 0 };
  const start = Math.max(20, c5.length - 288); // simulate the last ~24h

  for (let i = start; i < c5.length; i++) {
    const c = c5[i]!;
    const closeT = c.t + 5 * 60_000;

    if (trade) {
      const s = trade.direction === "buy" ? 1 : -1;
      const best = s > 0 ? c.high : c.low;
      const worst = s > 0 ? c.low : c.high;
      if ((worst - trade.sl) * s <= 0) {
        const pips = r1(((trade.sl - trade.entry) * s) / pip);
        if (trade.slMovedToEntry) {
          history.push({ time: iso(closeT), kind: "breakeven", text: `TP1 secured, rest closed at entry (breakeven)`, pips: 0 });
        } else {
          stats.losses++;
          stats.netPips += pips;
          history.push({ time: iso(closeT), kind: "sl", text: `Hit stop loss (${pips} pips)`, pips });
        }
        trade = null;
        continue;
      }
      if ((best - trade.tp2) * s >= 0) {
        const pips = r1(((trade.tp2 - trade.entry) * s) / pip);
        stats.wins++;
        stats.netPips += pips;
        if (!trade.tp1Hit) history.push({ time: iso(closeT), kind: "tp1", text: `TP1 hit` });
        history.push({ time: iso(closeT), kind: "tp_all", text: `Hit all TPs (+${pips} pips)`, pips });
        trade = null;
        continue;
      }
      if (!trade.tp1Hit && (best - trade.tp1) * s >= 0) {
        trade.tp1Hit = true;
        trade.tp1HitAt = iso(closeT);
        trade.sl = trade.entry;
        trade.slMovedToEntry = true;
        const pips = r1(((trade.tp1 - trade.entry) * s) / pip);
        history.push({ time: iso(closeT), kind: "tp1", text: `TP1 hit (+${pips} pips) — stop moved to entry`, pips });
      }
      continue;
    }

    const trend = trendAt(closeT);
    if (trend !== lastTrend) {
      if (lastTrend !== null)
        history.push({ time: iso(closeT), kind: "info", text: `1H trend turned ${trend} — no trade, waiting for price to reach a 15M ${trend === "bullish" ? "demand" : "supply"} zone` });
      lastTrend = trend;
    }
    const poi = activePoi(closeT, trend, c.close);
    if (!poi) continue;
    const buffer = Math.max(2 * pip, (poi.top - poi.bottom) * 0.1);

    if (trend === "bullish") {
      if (c.close < poi.bottom - buffer) {
        used.add(poi.t);
        history.push({ time: iso(closeT), kind: "info", text: `15M demand ${fmt(poi.bottom)}–${fmt(poi.top)} broken — setup cancelled, no trade` });
        continue;
      }
      const touched = c.low <= poi.top && c.low >= poi.bottom - buffer;
      if (touched && c.close > c.open && c.close > poi.top) {
        const entry = c.close;
        let sl = poi.bottom - buffer;
        let risk = (entry - sl) / pip;
        if (risk > MAX_SL_PIPS) { used.add(poi.t); history.push({ time: iso(closeT), kind: "info", text: `Setup skipped — stop would be ${r1(risk)} pips (max ${MAX_SL_PIPS})` }); continue; }
        if (risk < MIN_SL_PIPS) { sl = entry - MIN_SL_PIPS * pip; risk = MIN_SL_PIPS; }
        used.add(poi.t);
        trade = mkTrade("buy", entry, sl, risk, closeT);
        history.push({ time: iso(closeT), kind: "entry", text: `BUY @ ${fmt(entry)} from 15M demand · SL ${r1(risk)} pips` });
      }
    } else {
      if (c.close > poi.top + buffer) {
        used.add(poi.t);
        history.push({ time: iso(closeT), kind: "info", text: `15M supply ${fmt(poi.bottom)}–${fmt(poi.top)} broken — setup cancelled, no trade` });
        continue;
      }
      const touched = c.high >= poi.bottom && c.high <= poi.top + buffer;
      if (touched && c.close < c.open && c.close < poi.bottom) {
        const entry = c.close;
        let sl = poi.top + buffer;
        let risk = (sl - entry) / pip;
        if (risk > MAX_SL_PIPS) { used.add(poi.t); history.push({ time: iso(closeT), kind: "info", text: `Setup skipped — stop would be ${r1(risk)} pips (max ${MAX_SL_PIPS})` }); continue; }
        if (risk < MIN_SL_PIPS) { sl = entry + MIN_SL_PIPS * pip; risk = MIN_SL_PIPS; }
        used.add(poi.t);
        trade = mkTrade("sell", entry, sl, risk, closeT);
        history.push({ time: iso(closeT), kind: "entry", text: `SELL @ ${fmt(entry)} from 15M supply · SL ${r1(risk)} pips` });
      }
    }
  }

  function mkTrade(direction: "buy" | "sell", entry: number, sl: number, risk: number, t: number): Trade {
    const s = direction === "buy" ? 1 : -1;
    return {
      direction,
      entry: round(entry, decimals),
      sl: round(sl, decimals),
      tp1: round(entry + s * risk * 1.5 * pip, decimals),
      tp2: round(entry + s * risk * 3 * pip, decimals),
      riskPips: r1(risk),
      activatedAt: iso(t),
      validUntil: iso(t + ENTRY_WINDOW_MIN * 60_000),
      tp1Hit: false,
      tp1HitAt: null,
      runningPips: 0,
      slMovedToEntry: false,
    };
  }

  const last = c5[c5.length - 1]!;
  const price = last.close;
  const dayAgo = c5.find((c) => c.t >= last.t - 24 * 3_600_000) ?? c5[0]!;
  const changePct = ((price - dayAgo.close) / dayAgo.close) * 100;
  const trend = trendAt(Date.now());
  if (trade) trade.runningPips = r1(((price - trade.entry) * (trade.direction === "buy" ? 1 : -1)) / pip);
  const poiNow = activePoi(Date.now(), trend, price);
  const lastResult = [...history].reverse().find((h) => h.kind === "sl" || h.kind === "tp_all" || h.kind === "breakeven") ?? null;

  const waitingReason = trade
    ? ""
    : poiNow
      ? `1H trend is ${trend}. Waiting for price to tap the 15M ${trend === "bullish" ? "demand" : "supply"} zone ${fmt(poiNow.bottom)}–${fmt(poiNow.top)} and show a 5M rejection candle.`
      : `1H trend is ${trend}, but there is no fresh 15M ${trend === "bullish" ? "demand" : "supply"} zone yet. Waiting for structure to form.`;

  const gap = Math.abs(e20[e20.length - 1]! - e50[e50.length - 1]!) / price;
  const confidence = Math.round(Math.min(92, Math.max(55, 60 + gap * 4000 + (trade ? Math.max(0, 20 - trade.riskPips) : 0))));

  const analysis = [
    `1H trend: the 20 EMA is ${trend === "bullish" ? "above" : "below"} the 50 EMA, so only ${trend === "bullish" ? "BUY" : "SELL"} setups are taken on ${meta.id}.`,
    poiNow || trade
      ? `15M area of interest: the most recent ${trend === "bullish" ? "swing low (demand)" : "swing high (supply)"} zone is used as the point of interest.`
      : `15M area of interest: no unused zone in the trend direction right now.`,
    trade
      ? `5M sniper entry: price tapped the zone and closed with a ${trade.direction === "buy" ? "bullish" : "bearish"} rejection candle. Stop sits just beyond the zone for ${trade.riskPips} pips of risk; TP1 is 1.5R, TP2 is 3R. After TP1 the stop moves to entry.`
      : `5M entry rule: wait for price to tap the zone and close a rejection candle back out of it. Stops are capped at ${MAX_SL_PIPS} pips.`,
    `Last 24h on this pair: ${stats.wins} win(s), ${stats.losses} loss(es), net ${stats.netPips >= 0 ? "+" : ""}${r1(stats.netPips)} pips. Not financial advice.`,
  ];

  return {
    id: meta.id,
    symbol: meta.id,
    name: meta.name,
    category: meta.category,
    decimals,
    pip,
    price: round(price, decimals),
    changePct: round(changePct, 2),
    trend,
    poi: poiNow ? { top: poiNow.top, bottom: poiNow.bottom, time: iso(poiNow.t) } : null,
    trade,
    waitingReason,
    lastResult,
    confidence,
    candles: c5.slice(-80),
    history: history.slice(-12).reverse(),
    stats: { ...stats, netPips: r1(stats.netPips) },
    analysis,
    generatedAt: new Date().toISOString(),
  };
}
