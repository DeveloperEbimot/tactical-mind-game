import type {
  AttackAction,
  Attr,
  DefenceResponse,
  Player,
  TacticCard,
} from "./types";
import { FORMATIONS } from "./data";
import type { FormationName } from "./types";

export const ACTION_INFO: Record<
  AttackAction,
  { name: string; vs: string; desc: string }
> = {
  dribble: { name: "Dribble", vs: "vs Tackling", desc: "Take him on — beats a cover, dies to a tackle" },
  pass: { name: "Pass", vs: "vs Interception", desc: "Move the ball on, punished by covered lanes" },
  sprint: { name: "Sprint", vs: "vs Pace / Strength", desc: "Burst in behind, ruined by a drop-back" },
  shoot: { name: "Shoot", vs: "vs GK", desc: "Go for goal — pick a side and pray" },
};

export const RESPONSE_INFO: Record<DefenceResponse, { name: string; desc: string }> = {
  press: { name: "Press", desc: "Squeeze him, stops sprints and shots" },
  tackle: { name: "Tackle", desc: "Go to ground, kills dribbles" },
  cover: { name: "Cover lane", desc: "Block the pass, invites the dribble" },
  drop: { name: "Drop back", desc: "Sit deep, smothers runs in behind" },
};

const WEIGHTS: Record<AttackAction, Partial<Record<Attr, number>>> = {
  dribble: { dribbling: 0.55, pace: 0.25, composure: 0.2 },
  pass: { passing: 0.45, vision: 0.35, composure: 0.2 },
  sprint: { pace: 0.6, strength: 0.2, stamina: 0.2 },
  shoot: { shooting: 0.55, composure: 0.3, positioning: 0.15 },
};

const DEF_WEIGHTS: Record<DefenceResponse, Partial<Record<Attr, number>>> = {
  press: { tackling: 0.35, pace: 0.35, strength: 0.3 },
  tackle: { tackling: 0.55, strength: 0.25, positioning: 0.2 },
  cover: { interception: 0.5, positioning: 0.3, vision: 0.2 },
  drop: { positioning: 0.45, interception: 0.3, pace: 0.25 },
};

// Attacker delta by matchup — the mind game.
const MATRIX: Record<AttackAction, Record<DefenceResponse, number>> = {
  dribble: { press: -3, tackle: -11, cover: 9, drop: 4 },
  pass: { press: 3, tackle: 7, cover: -13, drop: -3 },
  sprint: { press: -6, tackle: -1, cover: 7, drop: -11 },
  shoot: { press: -9, tackle: 5, cover: 2, drop: -5 },
};

function weighted(p: Player, w: Partial<Record<Attr, number>>) {
  let total = 0;
  for (const [k, v] of Object.entries(w)) total += p.ratings[k as Attr] * (v as number);
  const fatigue = (100 - p.stamina) * 0.18;
  return total - fatigue;
}

export function tacticBonus(tactic: TacticCard | null, kind: "attack" | "defence") {
  if (!tactic) return 0;
  if (kind === "attack") {
    if (tactic === "counter") return 8;
    if (tactic === "tiki-taka") return 9;
    if (tactic === "overlap") return 8;
    if (tactic === "long-ball") return 6;
    if (tactic === "park-the-bus") return -8;
    return 0;
  }
  if (tactic === "high-press") return 8;
  if (tactic === "park-the-bus") return 12;
  return 0;
}

export function chemistry(carrier: Player, mate: Player | undefined) {
  if (!mate) return 0;
  let c = 0;
  if (carrier.club === mate.club) c += 3;
  if (carrier.role !== mate.role) c += 2;
  return c;
}

export interface BattleResult {
  attackScore: number;
  defenceScore: number;
  won: boolean;
  margin: number;
  roll: number;
}

export function resolveBattle(opts: {
  action: AttackAction;
  response: DefenceResponse;
  attacker: Player;
  defender: Player;
  attackFormation: FormationName;
  defenceFormation: FormationName;
  attackTactic: TacticCard | null;
  defenceTactic: TacticCard | null;
  momentum: number; // -100..100 positive favours attacking side
  chain: number;
}): BattleResult {
  const a =
    weighted(opts.attacker, WEIGHTS[opts.action]) +
    MATRIX[opts.action][opts.response] +
    FORMATIONS[opts.attackFormation].attack * 0.8 +
    tacticBonus(opts.attackTactic, "attack") +
    opts.momentum * 0.08 -
    opts.chain * 2;
  const d =
    weighted(opts.defender, DEF_WEIGHTS[opts.response]) +
    FORMATIONS[opts.defenceFormation].defence * 0.8 +
    tacticBonus(opts.defenceTactic, "defence");

  const roll = (Math.random() - 0.5) * 26; // controlled randomness — upsets happen
  const margin = a - d + roll;
  return { attackScore: Math.round(a), defenceScore: Math.round(d), won: margin > 0, margin, roll };
}

/** 0-100 shot chance based on how deep the attack got + shooter quality. */
export function shotChance(carrier: Player, progress: number, tactic: TacticCard | null) {
  const distance = Math.max(0, 100 - progress); // 0 = on the goal line
  const base = 78 - distance * 0.85;
  const quality = (carrier.ratings.shooting - 70) * 0.5 + (carrier.ratings.composure - 70) * 0.25;
  const fatigue = (100 - carrier.stamina) * 0.15;
  const tac = tactic === "park-the-bus" ? -6 : 0;
  return Math.max(6, Math.min(94, Math.round(base + quality - fatigue + tac)));
}

export function gkSaveBonus(gk: Player, correctDive: boolean) {
  if (!correctDive) return 0;
  const style = gk.gkStyle === "Shot Stopper" ? 12 : 6;
  return style + (gk.ratings.positioning - 80) * 0.4;
}

export function pickAiResponse(action: AttackAction | null): DefenceResponse {
  const all: DefenceResponse[] = ["press", "tackle", "cover", "drop"];
  // Slight read on the attacker, still mostly a guess.
  if (action && Math.random() < 0.35) {
    const counter: Record<AttackAction, DefenceResponse> = {
      dribble: "tackle",
      pass: "cover",
      sprint: "drop",
      shoot: "press",
    };
    return counter[action];
  }
  return all[Math.floor(Math.random() * all.length)];
}

export function pickAiAction(progress: number, carrier: Player): AttackAction {
  const r = Math.random();
  if (progress > 74 && r < 0.55) return "shoot";
  if (carrier.ratings.pace > 85 && r < 0.35) return "sprint";
  if (r < 0.4) return "dribble";
  if (r < 0.75) return "pass";
  return progress > 62 ? "shoot" : "dribble";
}
