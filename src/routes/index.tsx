import { createFileRoute, Link } from "@tanstack/react-router";
import { money, useClub } from "@/game/club";
import { FORMATIONS } from "@/game/data";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Ballers Shirts — Tactical Football Card Duel" },
      {
        name: "description",
        content:
          "Manage your club and play turn-based 11v11 football duels: sign players, set your shape, read your opponent and bury your chances.",
      },
      { property: "og:title", content: "Ballers Shirts — Tactical Football Card Duel" },
      {
        property: "og:description",
        content:
          "Sign players, pick your formation and mentality, then win the mind game on match day.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Menu,
});

function Menu() {
  const { club, ready } = useClub();

  const items = [
    {
      to: "/match",
      title: "Play match",
      blurb: "Exhibition vs AI · 90 minutes of duels",
      primary: true,
    },
    { to: "/transfers", title: "Transfer market", blurb: "Sign players with your balance" },
    { to: "/squad", title: "Squad", blurb: "Your XI, bench and signings" },
    { to: "/settings", title: "Settings", blurb: "Club name, shape, mentality, reset" },
  ] as const;

  return (
    <main className="mx-auto min-h-screen w-full max-w-3xl px-4 pb-12 pt-8">
      <header className="mb-6">
        <p className="text-[11px] uppercase tracking-[0.3em] text-muted-foreground">Season 1</p>
        <h1 className="text-4xl leading-none sm:text-5xl">Ballers Shirts</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Tactical 11v11 duels. Every attack is a mind game.
        </p>
      </header>

      <section className="panel mb-6 flex flex-wrap items-center justify-between gap-3 p-4">
        <div>
          <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Your club</p>
          <p className="text-xl font-bold leading-tight">{club.name}</p>
          <p className="text-[11px] text-muted-foreground">
            {club.short} · {club.formation} · {club.mentality}
            {" · "}
            {FORMATIONS[club.formation]!.blurb}
          </p>
        </div>
        <div className="text-right">
          <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Balance</p>
          <p className="display text-2xl text-accent tabular-nums">
            {ready ? money(club.balance) : "—"}
          </p>
          <p className="text-[11px] text-muted-foreground">
            {club.played} played · {club.won}W {club.drawn}D {club.lost}L
          </p>
        </div>
      </section>

      <nav className="grid gap-2 sm:grid-cols-2">
        {items.map((i) => (
          <Link
            key={i.to}
            to={i.to}
            className={`rounded-lg border px-4 py-4 transition-colors ${
              "primary" in i && i.primary
                ? "border-accent bg-accent text-accent-foreground"
                : "border-border bg-secondary hover:border-accent"
            }`}
          >
            <span className="block text-base font-bold uppercase tracking-wide">{i.title}</span>
            <span className="block text-[11px] opacity-80">{i.blurb}</span>
          </Link>
        ))}
      </nav>

      <section className="panel mt-6 p-4">
        <h2 className="text-sm font-bold uppercase tracking-widest">Online PvP</h2>
        <p className="mt-1 text-[12px] text-muted-foreground">
          Head-to-head matches with join codes are next up. For now every match is played against
          the AI manager.
        </p>
      </section>

      <p className="mt-6 text-[11px] text-muted-foreground">
        Prize money: {money(2_000_000)} for a win, {money(900_000)} for a draw,{" "}
        {money(350_000)} for a loss.
      </p>
    </main>
  );
}
