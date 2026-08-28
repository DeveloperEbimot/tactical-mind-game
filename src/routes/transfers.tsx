import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { buildMarket, money, sellValue, useClub, type MarketPlayer } from "@/game/club";
import { overall } from "@/game/data";

export const Route = createFileRoute("/transfers")({
  head: () => ({
    meta: [
      { title: "Transfer Market — Ballers Shirts" },
      {
        name: "description",
        content:
          "Spend your prize money on strikers, midfielders, defenders and keepers, then send them straight to your match-day bench.",
      },
      { property: "og:title", content: "Transfer Market — Ballers Shirts" },
      {
        property: "og:description",
        content: "Scout the market, compare ratings and sign players for your club.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Transfers,
});

const ROLES = ["ALL", "GK", "DEF", "MID", "ATT"] as const;

function Transfers() {
  const { club, ready, update } = useClub();
  const market = useMemo(() => buildMarket(), []);
  const [filter, setFilter] = useState<(typeof ROLES)[number]>("ALL");
  const [note, setNote] = useState<string | null>(null);

  const ownedIds = new Set(club.signings.map((p) => p.id));
  const listed = market.filter(
    (p) => (filter === "ALL" || p.role === filter) && !ownedIds.has(p.id),
  );

  const sign = (p: MarketPlayer) => {
    if (!ready) return;
    if (club.balance < p.price) {
      setNote(`Not enough in the bank for ${p.name}.`);
      return;
    }
    if (club.signings.length >= 7) {
      setNote("Squad space is full — sell someone first.");
      return;
    }
    update((c) => ({
      ...c,
      balance: c.balance - p.price,
      signings: [...c.signings, { ...p, stamina: 100 }],
    }));
    setNote(`${p.name} signs for ${money(p.price)}.`);
  };

  const sell = (id: string) => {
    update((c) => {
      const p = c.signings.find((x) => x.id === id);
      if (!p) return c;
      return {
        ...c,
        balance: c.balance + sellValue(p),
        signings: c.signings.filter((x) => x.id !== id),
      };
    });
  };

  return (
    <main className="mx-auto min-h-screen w-full max-w-3xl px-4 pb-12 pt-6">
      <header className="mb-4 flex items-end justify-between">
        <div>
          <h1 className="text-2xl leading-none sm:text-3xl">Transfer market</h1>
          <p className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
            Balance {ready ? money(club.balance) : "—"}
          </p>
        </div>
        <Link
          to="/"
          className="rounded-md border border-border px-3 py-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground hover:text-foreground"
        >
          Menu
        </Link>
      </header>

      {note && <p className="panel mb-3 p-2 text-[12px] text-accent">{note}</p>}

      <div className="mb-3 flex gap-2">
        {ROLES.map((r) => (
          <button
            key={r}
            onClick={() => setFilter(r)}
            className={`rounded-md px-3 py-1.5 text-[11px] font-bold uppercase tracking-widest ${
              filter === r ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground"
            }`}
          >
            {r}
          </button>
        ))}
      </div>

      <ul className="grid gap-2 sm:grid-cols-2">
        {listed.map((p) => (
          <li key={p.id} className="panel p-3">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-sm font-bold">
                  {p.label} {p.name}
                </p>
                <p className="text-[11px] text-muted-foreground">
                  {p.club} · OVR {p.ovr}
                  {p.gkStyle ? ` · ${p.gkStyle}` : ""}
                </p>
              </div>
              <span className="display text-sm text-accent tabular-nums">{money(p.price)}</span>
            </div>
            <p className="mt-1 text-[11px] text-muted-foreground">
              SHO {p.ratings.shooting} · PAS {p.ratings.passing} · DRI {p.ratings.dribbling} · PAC{" "}
              {p.ratings.pace} · TAC {p.ratings.tackling} · STR {p.ratings.strength}
            </p>
            <button
              onClick={() => sign(p)}
              disabled={!ready || club.balance < p.price}
              className="mt-2 w-full rounded-md bg-primary py-2 text-[11px] font-bold uppercase tracking-widest text-primary-foreground disabled:opacity-40"
            >
              Sign
            </button>
          </li>
        ))}
      </ul>

      <section className="panel mt-6 p-3">
        <h2 className="mb-2 text-[11px] uppercase tracking-widest text-muted-foreground">
          Your signings ({club.signings.length}/7)
        </h2>
        {club.signings.length === 0 && (
          <p className="text-[12px] text-muted-foreground">
            No signings yet — bought players join your match-day bench.
          </p>
        )}
        <ul className="space-y-2">
          {club.signings.map((p) => (
            <li key={p.id} className="flex items-center justify-between gap-2">
              <span className="text-[12px]">
                <span className="font-bold">
                  {p.label} {p.name}
                </span>{" "}
                <span className="text-muted-foreground">OVR {overall(p)}</span>
              </span>
              <button
                onClick={() => sell(p.id)}
                className="rounded-md border border-border px-2 py-1 text-[10px] font-bold uppercase tracking-widest text-muted-foreground hover:text-destructive"
              >
                Sell {money(sellValue(p))}
              </button>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
