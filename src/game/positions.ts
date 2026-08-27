import { FORMATIONS } from "./data";
import type { Mentality, Player, Side, TeamState } from "./types";

export interface Pt {
  x: number;
  y: number;
}

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

interface Shape {
  /** Base shift along the attacking direction, applied always. */
  shift: number;
  capDef: number;
  capMid: number;
  capAtt: number;
  /** Furthest up the pitch an outfielder may be while defending. */
  defMax: number;
  /** Deepest an outfielder may sit while defending. */
  defMin: number;
}

const SHAPES: Record<Mentality, Shape> = {
  attack: { shift: 16, capDef: 58, capMid: 80, capAtt: 93, defMax: 70, defMin: 42 },
  balanced: { shift: 0, capDef: 45, capMid: 62, capAtt: 82, defMax: 49, defMin: 8 },
  defend: { shift: -12, capDef: 30, capMid: 42, capAtt: 54, defMax: 40, defMin: 6 },
};

const capFor = (role: Player["role"], shape: Shape) =>
  role === "DEF" ? shape.capDef : role === "MID" ? shape.capMid : shape.capAtt;

/** Live on-pitch positions for one team, driven by formation + mentality. */
export function buildPositions(args: {
  team: TeamState;
  side: Side;
  attacking: boolean;
  carrierIdx: number;
  defenderIdx: number;
  ballX: number;
  ballY: number;
  progress: number;
  carrierAnchor?: Pt | null;
}): Pt[] {
  const slots = FORMATIONS[args.team.formation]!.slots;
  const shape = SHAPES[args.team.mentality ?? "balanced"];

  return args.team.players.map((p, i) => {
    const slot = slots[i]!;
    let own = slot.x; // in "own-goal = 0" space
    let y = slot.y;

    if (p.role === "GK") {
      return { x: args.side === "home" ? 4 : 96, y: 50 };
    }

    if (args.attacking && i === args.carrierIdx) {
      const pt = args.carrierAnchor ?? { x: args.ballX, y: args.ballY };
      return { x: clamp(pt.x, 3, 97), y: clamp(pt.y, 6, 94) };
    }

    if (!args.attacking && i === args.defenderIdx) {
      // The closest defender steps to the ball rather than teleporting across the pitch.
      const x = args.ballX + (args.side === "home" ? -3.5 : 3.5);
      const yy = args.ballY + (i % 2 === 0 ? -5 : 5);
      return { x: clamp(x, 3, 97), y: clamp(yy, 6, 94) };
    }

    if (args.attacking) {
      const push = Math.max(0, (args.progress - 46) * 0.22) + shape.shift;
      own = Math.min(slot.x + push, capFor(p.role, shape));
    } else {
      const drop = Math.max(0, (args.progress - 46) * 0.16);
      own = slot.x - drop + shape.shift;
      own = clamp(own, shape.defMin, shape.defMax);
    }

    const x = args.side === "home" ? own : 100 - own;
    return { x: clamp(x, 3, 97), y: clamp(y, 6, 94) };
  });
}

/** Closest outfield opponent to the ball — the only player allowed to contest it. */
export function nearestOpponent(
  defPos: Pt[],
  players: Player[],
  ball: Pt,
): { idx: number; dist: number } {
  let best = { idx: 1, dist: Infinity };
  defPos.forEach((pt, i) => {
    const p = players[i];
    if (!p || p.role === "GK" || p.stamina <= 3) return;
    const dist = Math.hypot(pt.x - ball.x, pt.y - ball.y);
    if (dist < best.dist) best = { idx: i, dist };
  });
  return best;
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
