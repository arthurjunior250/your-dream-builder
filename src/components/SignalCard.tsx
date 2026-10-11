import { useEffect, useState } from "react";
import { Check, CircleCheck, Clock, Copy, Hourglass, TrendingDown, TrendingUp, XCircle } from "lucide-react";
import type { HistoryEvent, Signal } from "@/lib/signals";
import { CandleChart } from "./CandleChart";

const fmtTime = (iso: string) =>
  new Date(iso).toLocaleString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "UTC" }) + " UTC";

function useNow() {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  return now;
}

function LevelBox({ label, value, tone, hit }: { label: string; value: string; tone: "entry" | "tp" | "sl"; hit?: boolean }) {
  const toneClass =
    tone === "tp" ? "border-buy/40 bg-buy/10 text-buy" : tone === "sl" ? "border-sell/40 bg-sell/10 text-sell" : "border-chart-3/40 bg-chart-3/10 text-chart-3";
  return (
    <div className={`relative rounded-lg border px-3 py-2 text-center ${toneClass} ${hit ? "ring-2 ring-buy" : ""}`}>
      {hit && <CircleCheck className="absolute -top-2 -right-2 size-5 rounded-full bg-card text-buy" />}
      <div className="text-[10px] font-semibold tracking-widest uppercase opacity-80">{label}</div>
      <div className="font-mono-num text-sm font-bold">{value}</div>
    </div>
  );
}

function eventTone(e: HistoryEvent) {
  if (e.kind === "sl") return "text-sell";
  if (e.kind === "tp1" || e.kind === "tp_all") return "text-buy";
  if (e.kind === "entry") return "text-chart-3";
  return "text-muted-foreground";
}

export function SignalCard({ signal }: { signal: Signal }) {
  const [copied, setCopied] = useState(false);
  const now = useNow();
  const t = signal.trade;
  const fmt = (v: number) => v.toFixed(signal.decimals);
  const isBuy = t?.direction === "buy";

  const msLeft = t && now ? new Date(t.validUntil).getTime() - now : 0;
  const late = t && now ? Math.floor((now - new Date(t.activatedAt).getTime()) / 60000) : 0;
  const mmss = (ms: number) => `${Math.floor(ms / 60000)}:${String(Math.floor((ms % 60000) / 1000)).padStart(2, "0")}`;
  const lateLabel = late >= 60 ? `${Math.floor(late / 60)}h ${late % 60}m` : `${late}m`;

  const copySignal = async () => {
    if (!t) return;
    const text = `${signal.symbol} ${t.direction.toUpperCase()}\nEntry: ${fmt(t.entry)}\nTP1: ${fmt(t.tp1)}\nTP2: ${fmt(t.tp2)}\nSL: ${fmt(t.sl)} (${t.riskPips} pips)`;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard unavailable */
    }
  };

  return (
    <article className="card-glow overflow-hidden rounded-2xl bg-card">
      <header className="flex items-center justify-between border-b border-border px-5 py-3">
        <div className="flex items-center gap-2">
          <span className={`size-2 rounded-full ${t ? (isBuy ? "bg-buy" : "bg-sell") : "bg-muted-foreground"} animate-pulse`} />
          <span className="font-mono-num text-sm font-bold">{signal.symbol}</span>
          <span className="rounded bg-secondary px-2 py-0.5 text-[10px] font-semibold text-secondary-foreground">{signal.category}</span>
        </div>
        <div className="text-right text-[10px] text-muted-foreground">
          1H trend:{" "}
          <span className={`font-bold uppercase ${signal.trend === "bullish" ? "text-buy" : "text-sell"}`}>{signal.trend}</span>
          <div className="font-mono-num text-sm font-bold text-foreground">{fmt(signal.price)}</div>
        </div>
      </header>

      <div className="px-5 pt-4">
        {t ? (
          <>
            <div className={`flex items-center justify-center gap-2 rounded-xl py-2.5 text-lg font-extrabold tracking-widest uppercase ${isBuy ? "bg-buy/15 text-buy" : "bg-sell/15 text-sell"}`}>
              {isBuy ? <TrendingUp className="size-5" /> : <TrendingDown className="size-5" />}
              {t.direction} · Active
            </div>

            <div className="mt-3 grid grid-cols-3 gap-2">
              <div className={`rounded-lg border px-3 py-2 text-center ${t.runningPips >= 0 ? "border-buy/40 bg-buy/10 text-buy" : "border-sell/40 bg-sell/10 text-sell"}`}>
                <div className="text-[10px] font-semibold tracking-widest uppercase opacity-80">Running P/L</div>
                <div className="font-mono-num text-lg font-bold">
                  {t.runningPips >= 0 ? "+" : ""}
                  {t.runningPips} pips
                </div>
              </div>
              <div className="rounded-lg border border-border bg-secondary/40 px-3 py-2 text-center">
                <div className="flex items-center justify-center gap-1 text-[10px] font-semibold tracking-widest text-muted-foreground uppercase">
                  <Clock className="size-3" /> Activated
                </div>
                <div className="font-mono-num text-xs font-bold">{fmtTime(t.activatedAt)}</div>
                {now && <div className="text-[10px] text-muted-foreground">{lateLabel} ago</div>}
              </div>
              <div className={`rounded-lg border px-3 py-2 text-center ${msLeft > 0 ? "border-primary/40 bg-primary/10 text-primary" : "border-border bg-secondary/40 text-muted-foreground"}`}>
                <div className="flex items-center justify-center gap-1 text-[10px] font-semibold tracking-widest uppercase">
                  <Hourglass className="size-3" /> Time left to enter
                </div>
                <div className="font-mono-num text-lg font-bold">{now ? (msLeft > 0 ? mmss(msLeft) : "Closed") : "—"}</div>
                <div className="text-[10px] opacity-80">{msLeft > 0 ? "Late entry still OK" : "Too late — skip"}</div>
              </div>
            </div>

            <div className="mt-3 grid grid-cols-4 gap-2">
              <LevelBox label="Entry" value={fmt(t.entry)} tone="entry" />
              <LevelBox label="TP1" value={fmt(t.tp1)} tone="tp" hit={t.tp1Hit} />
              <LevelBox label="TP2" value={fmt(t.tp2)} tone="tp" />
              <LevelBox label={t.slMovedToEntry ? "SL (BE)" : `SL ${t.riskPips}p`} value={fmt(t.sl)} tone="sl" />
            </div>
          </>
        ) : (
          <div className="rounded-xl border border-dashed border-border bg-secondary/30 px-4 py-5 text-center">
            {signal.lastResult && (
              <div className={`mb-2 flex items-center justify-center gap-2 text-sm font-bold ${signal.lastResult.kind === "sl" ? "text-sell" : "text-buy"}`}>
                {signal.lastResult.kind === "sl" ? <XCircle className="size-4" /> : <CircleCheck className="size-4" />}
                {signal.lastResult.text}
              </div>
            )}
            <div className="flex items-center justify-center gap-2 text-lg font-extrabold tracking-widest text-muted-foreground uppercase">
              <Hourglass className="size-5" />
              {signal.lastResult ? "Waiting for next entry" : "Waiting for signal"}
            </div>
            <p className="mt-2 text-xs text-muted-foreground">{signal.waitingReason}</p>
          </div>
        )}

        <div className="mt-4 overflow-hidden rounded-xl border border-border">
          <CandleChart candles={signal.candles} decimals={signal.decimals} levels={t} poi={t ? null : signal.poi} />
        </div>

        <div className="mt-4">
          <div className="mb-2 flex items-center justify-between">
            <h3 className="text-xs font-bold tracking-widest text-muted-foreground uppercase">History (24h)</h3>
            <span className="font-mono-num text-xs">
              <span className="text-buy">{signal.stats.wins}W</span> / <span className="text-sell">{signal.stats.losses}L</span> ·{" "}
              <span className={signal.stats.netPips >= 0 ? "text-buy" : "text-sell"}>
                {signal.stats.netPips >= 0 ? "+" : ""}
                {signal.stats.netPips} pips
              </span>
            </span>
          </div>
          {signal.history.length === 0 ? (
            <p className="text-xs text-muted-foreground">No events yet — no setup has formed in the last 24 hours.</p>
          ) : (
            <ul className="divide-y divide-border rounded-lg border border-border">
              {signal.history.map((h, i) => (
                <li key={i} className="flex items-start justify-between gap-3 px-3 py-2 text-xs">
                  <span className={`font-semibold ${eventTone(h)}`}>{h.text}</span>
                  <span className="font-mono-num shrink-0 text-muted-foreground">{fmtTime(h.time)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="mt-4 space-y-2">
          <h3 className="text-xs font-bold tracking-widest text-muted-foreground uppercase">How this setup is read</h3>
          {signal.analysis.map((p, i) => (
            <p key={i} className="text-sm leading-relaxed text-muted-foreground">{p}</p>
          ))}
        </div>
      </div>

      <footer className="mt-5 flex items-center justify-between border-t border-border px-5 py-3">
        <span className="text-[10px] text-muted-foreground">1H trend · 15M POI · 5M entry</span>
        {t && (
          <button onClick={copySignal} className="flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-bold text-primary-foreground">
            {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
            {copied ? "Copied" : "Copy Signal"}
          </button>
        )}
      </footer>
    </article>
  );
}
