import { positionsFor, type MatchState } from "@/game/useMatch";

interface Props {
  state: MatchState;
  onPickTarget: (idx: number) => void;
}

export function Pitch({ state: s, onPickTarget }: Props) {
  const pos = positionsFor(s);
  const picking = s.phase === "choose-pass-target";
  const targets = s.passTargets ?? [];

  const dots = [
    ...s.home.players.map((player, i) => ({
      player,
      i,
      side: "home" as const,
      pt: pos.home[i]!,
      carrier: s.possession === "home" && i === s.carrierIdx,
      engaged: s.possession === "away" && i === s.defenderIdx,
      target: picking && targets.includes(i),
    })),
    ...s.away.players.map((player, i) => ({
      player,
      i,
      side: "away" as const,
      pt: pos.away[i]!,
      carrier: s.possession === "away" && i === s.carrierIdx,
      engaged: s.possession === "home" && i === s.defenderIdx,
      target: false,
    })),
  ];

  return (
    <div className="pitch relative aspect-[3/2] w-full overflow-hidden rounded-lg">
      <div className="pointer-events-none absolute inset-2 rounded-sm border border-chalk/50" />
      <div className="pointer-events-none absolute inset-y-2 left-1/2 w-px -translate-x-1/2 bg-chalk/50" />
      <div className="pointer-events-none absolute left-1/2 top-1/2 aspect-square h-[26%] -translate-x-1/2 -translate-y-1/2 rounded-full border border-chalk/50" />
      <div className="pointer-events-none absolute left-2 top-1/2 h-[42%] w-[13%] -translate-y-1/2 border border-chalk/50" />
      <div className="pointer-events-none absolute right-2 top-1/2 h-[42%] w-[13%] -translate-y-1/2 border border-chalk/50" />
      <div className="pointer-events-none absolute left-0 top-1/2 h-[20%] w-[4%] -translate-y-1/2 border border-chalk/70 bg-chalk/10" />
      <div className="pointer-events-none absolute right-0 top-1/2 h-[20%] w-[4%] -translate-y-1/2 border border-chalk/70 bg-chalk/10" />

      {dots.map((d) => (
        <div
          key={d.player.id}
          className="absolute -translate-x-1/2 -translate-y-1/2"
          style={{
            left: `${d.pt.x}%`,
            top: `${d.pt.y}%`,
            transition: "left 900ms cubic-bezier(0.33, 0, 0.25, 1), top 900ms cubic-bezier(0.33, 0, 0.25, 1)",
          }}
        >
          <button
            type="button"
            disabled={!d.target}
            onClick={() => d.target && onPickTarget(d.i)}
            className={[
              "flex h-[18px] w-[18px] items-center justify-center rounded-full text-[8px] font-bold leading-none sm:h-6 sm:w-6 sm:text-[10px]",
              d.side === "home" ? "kit-home" : "kit-away",
              d.carrier ? "ring-2 ring-accent scale-125 z-20" : "",
              d.engaged ? "ring-2 ring-destructive z-10" : "",
              d.target ? "ring-2 ring-accent animate-pulse cursor-pointer z-20" : "",
              d.player.stamina < 40 ? "opacity-60" : "",
            ].join(" ")}
          >
            {d.player.num}
          </button>
          {(d.carrier || d.engaged || d.target) && (
            <span className="absolute left-1/2 top-full mt-0.5 -translate-x-1/2 whitespace-nowrap rounded bg-background/85 px-1 text-[8px] font-semibold tracking-wide text-foreground">
              {d.player.name}
            </span>
          )}
        </div>
      ))}

      <div
        className="absolute z-30 h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-accent shadow-[0_0_10px_2px_var(--accent)]"
        style={{
          left: `${s.ball.x}%`,
          top: `${s.ball.y}%`,
          transition: `left ${s.ballSpeed}ms cubic-bezier(0.2, 0.6, 0.25, 1), top ${s.ballSpeed}ms cubic-bezier(0.2, 0.6, 0.25, 1)`,
        }}
      />
    </div>
  );
}
