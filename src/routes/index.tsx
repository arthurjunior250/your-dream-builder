import { createFileRoute } from "@tanstack/react-router";
import { queryOptions, useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Activity, Bot, Radio } from "lucide-react";
import type { Signal } from "@/lib/signals";
import { SignalCard } from "@/components/SignalCard";

interface QuotesResponse {
  signals: Signal[];
  generatedAt: string;
}

const signalsQuery = queryOptions({
  queryKey: ["signals"],
  queryFn: async (): Promise<QuotesResponse> => {
    const res = await fetch("/api/public/quotes");
    if (!res.ok) throw new Error("Failed to load market signals");
    return res.json();
  },
  refetchInterval: 60_000,
  staleTime: 60_000,
});

export const Route = createFileRoute("/")({
  loader: ({ context }) =>
    typeof window !== "undefined"
      ? context.queryClient.ensureQueryData(signalsQuery)
      : undefined,
  head: () => ({
    meta: [
      { title: "SignalEdge — AI Trading Signals for Forex, Crypto, Gold & Indices" },
      {
        name: "description",
        content:
          "Live AI-generated trading signals with entry, take-profit, stop-loss and confidence scores across forex, crypto, commodities and indices.",
      },
      { property: "og:title", content: "SignalEdge — AI Trading Signals" },
      {
        property: "og:description",
        content:
          "Live AI trading signals with entry, TP, SL and confidence scores across forex, crypto, commodities and indices.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
  errorComponent: ({ error }) => (
    <div role="alert" className="flex min-h-screen items-center justify-center text-sm text-muted-foreground">
      {error instanceof Error ? error.message : "Failed to load signals"}
    </div>
  ),
});

const CATEGORIES = ["All", "Forex", "Crypto", "Commodities", "Indices"] as const;

function Index() {
  const { data, isPending } = useQuery(signalsQuery);
  const [category, setCategory] = useState<(typeof CATEGORIES)[number]>("All");

  const all = data?.signals ?? [];
  const signals = category === "All" ? all : all.filter((s) => s.category === category);

  return (
    <div className="min-h-screen bg-background">
      <nav className="sticky top-0 z-10 border-b border-border bg-background/80 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2">
            <Activity className="size-5 text-primary" />
            <span className="text-lg font-extrabold tracking-tight">
              Signal<span className="text-primary">Edge</span>
            </span>
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Radio className="size-3.5 text-buy animate-pulse" />
            Live feed
          </div>
        </div>
      </nav>

      <header className="mx-auto max-w-3xl px-4 pt-12 pb-8 text-center">
        <div className="mx-auto mb-4 flex size-14 items-center justify-center rounded-2xl bg-primary/15">
          <Bot className="size-7 text-primary" />
        </div>
        <h1 className="text-glow text-3xl font-extrabold tracking-tight sm:text-4xl">
          AI Trading Signals
        </h1>
        <p className="mx-auto mt-3 max-w-md text-sm text-muted-foreground">
          Algorithmic trade setups with entry, take-profit, stop-loss and confidence scoring —
          recalculated from live market data.
        </p>

        <div className="mt-6 flex flex-wrap justify-center gap-2">
          {CATEGORIES.map((c) => (
            <button
              key={c}
              onClick={() => setCategory(c)}
              className={`rounded-full px-4 py-1.5 text-xs font-bold transition-colors ${
                category === c
                  ? "bg-primary text-primary-foreground"
                  : "bg-secondary text-secondary-foreground hover:bg-accent"
              }`}
            >
              {c}
            </button>
          ))}
        </div>

        <div className="mt-6 grid grid-cols-3 gap-2 sm:grid-cols-3">
          {all.slice(0, 9).map((s) => (
            <div key={s.id} className="rounded-xl border border-border bg-card px-3 py-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold">{s.symbol}</span>
                <span
                  className={`size-1.5 rounded-full ${s.direction === "buy" ? "bg-buy" : "bg-sell"}`}
                />
              </div>
              <div className="font-mono-num mt-1 text-sm font-bold">
                {s.price.toFixed(s.decimals)}
              </div>
              <div
                className={`font-mono-num text-[10px] font-semibold ${
                  s.changePct >= 0 ? "text-buy" : "text-sell"
                }`}
              >
                {s.changePct >= 0 ? "+" : ""}
                {s.changePct}%
              </div>
            </div>
          ))}
        </div>
      </header>

      <main className="mx-auto max-w-3xl space-y-8 px-4 pb-16">
        {isPending && (
          <p className="py-12 text-center text-sm text-muted-foreground">Loading live signals…</p>
        )}
        {!isPending && signals.length === 0 && (
          <p className="py-12 text-center text-sm text-muted-foreground">
            No signals available for this category right now.
          </p>
        )}
        {signals.map((s) => (
          <SignalCard key={s.id} signal={s} />
        ))}
      </main>

      <footer className="border-t border-border py-8 text-center text-xs text-muted-foreground">
        <p>SignalEdge · Signals are generated from end-of-day market data and are not financial advice.</p>
      </footer>
    </div>
  );
}
