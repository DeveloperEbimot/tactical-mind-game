import { FORMATIONS } from "./data";
import type { Side, TeamState } from "./types";

export interface Pt {
  x: number;
  y: number;
}

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

/** Live on-pitch positions for one team. Defending outfielders never cross the halfway line. */
export function buildPositions(args: {
  team: TeamState;
  side: Side;
  attacking: boolean;
  carrierIdx: number;
  defenderIdx: number;
  ballX: number;
  ballY: number;
  progress: number;
}): Pt[] {
  const slots = FORMATIONS[args.team.formation]!.slots;
  return args.team.players.map((p, i) => {
    const slot = slots[i]!;
    let x = args.side === "home" ? slot.x : 100 - slot.x;
    let y = slot.y;

    if (p.role === "GK") {
      return { x: args.side === "home" ? 4 : 96, y: 50 };
    }

    if (args.attacking && i === args.carrierIdx) {
      x = args.ballX;
      y = args.ballY;
    } else if (!args.attacking && i === args.defenderIdx) {
      x = args.ballX + (args.side === "home" ? -4 : 4);
      y = args.ballY + (i % 2 === 0 ? -6 : 6);
    } else if (args.attacking) {
      const shift = (args.progress - 46) * 0.3;
      x = args.side === "home" ? slot.x + shift : 100 - slot.x - shift;
    } else {
      // Defending shape drops towards its own goal as the attack gets deeper.
      const drop = Math.max(0, (args.progress - 46) * 0.16);
      x = args.side === "home" ? x - drop : x + drop;
    }

    if (!args.attacking) {
      x = args.side === "home" ? Math.min(x, 49) : Math.max(x, 51);
    }

    return { x: clamp(x, 3, 97), y: clamp(y, 6, 94) };
  });
}

export function distToSegment(p: Pt, a: Pt, b: Pt) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len2 = dx * dx + dy * dy || 1;
  let t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2;
  t = clamp(t, 0, 1);
  const px = a.x + t * dx;
  const py = a.y + t * dy;
  return { dist: Math.hypot(p.x - px, p.y - py), t, point: { x: px, y: py } as Pt };
}
