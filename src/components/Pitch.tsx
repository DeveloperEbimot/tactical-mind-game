import { FORMATIONS } from "@/game/data";
import type { Player, TeamState } from "@/game/types";

interface Props {
  home: TeamState;
  away: TeamState;
  possession: "home" | "away";
  carrierIdx: number;
  defenderIdx: number;
  progress: number;
  lane: number;
}

interface Dot {
  player: Player;
  x: number;
  y: number;
  side: "home" | "away";
  carrier: boolean;
  engaged: boolean;
}

export function Pitch({
  home,
  away,
  possession,
  carrierIdx,
  defenderIdx,
  progress,
  lane,
}: Props) {
  // Ball: home attacks to the right, away to the left.
  const ballX = possession === "home" ? progress : 100 - progress;
  const ballY = lane;

  const build = (team: TeamState, side: "home" | "away"): Dot[] => {
    const slots = FORMATIONS[team.formation]!.slots;
    const attacking = possession === side;
    return team.players.map((player, i) => {
      const slot = slots[i]!;
      let x = side === "home" ? slot.x : 100 - slot.x;
      let y = slot.y;
      const carrier = attacking && i === carrierIdx;
      const engaged = !attacking && i === defenderIdx && player.role !== "GK";
      if (carrier) {
        x = ballX;
        y = ballY;
      } else if (engaged) {
        x = ballX + (side === "home" ? -5 : 5);
        y = ballY + (i % 2 === 0 ? -7 : 7);
      } else if (attacking) {
        // push the shape up with the ball
        const shift = (progress - 46) * 0.28;
        x = side === "home" ? slot.x + shift : 100 - slot.x - shift;
      }
      return {
        player,
        x: Math.max(2, Math.min(98, x)),
        y: Math.max(5, Math.min(95, y)),
        side,
        carrier,
        engaged,
      };
    });
  };

  const dots = [...build(home, "home"), ...build(away, "away")];

  return (
    <div className="pitch relative aspect-[3/2] w-full overflow-hidden rounded-lg">
      {/* markings */}
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
          className="absolute -translate-x-1/2 -translate-y-1/2 transition-all duration-500 ease-out"
          style={{ left: `${d.x}%`, top: `${d.y}%` }}
        >
          <div
            className={[
              "flex h-[18px] w-[18px] items-center justify-center rounded-full text-[8px] font-bold leading-none sm:h-6 sm:w-6 sm:text-[10px]",
              d.side === "home" ? "kit-home" : "kit-away",
              d.carrier ? "ring-2 ring-accent scale-125 z-20" : "",
              d.engaged ? "ring-2 ring-destructive z-10" : "",
              d.player.stamina < 40 ? "opacity-60" : "",
            ].join(" ")}
          >
            {d.player.num}
          </div>
          {(d.carrier || d.engaged) && (
            <span className="absolute left-1/2 top-full mt-0.5 -translate-x-1/2 whitespace-nowrap rounded bg-background/85 px-1 text-[8px] font-semibold tracking-wide text-foreground">
              {d.player.name}
            </span>
          )}
        </div>
      ))}

      {/* ball */}
      <div
        className="absolute z-30 h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-accent shadow-[0_0_10px_2px_var(--accent)] transition-all duration-500"
        style={{ left: `${ballX}%`, top: `${ballY}%` }}
      />
    </div>
  );
}
