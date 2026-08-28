import type { Formation, FormationName, GkStyle, Player, Ratings, Role, Slot } from "./types";

export const FORMATIONS: Record<FormationName, Formation> = {
  "4-4-2": {
    name: "4-4-2",
    blurb: "Solid block, two up top",
    attack: 0,
    midfield: 2,
    defence: 3,
    slots: [
      { role: "GK", label: "GK", x: 5, y: 50 },
      { role: "DEF", label: "LB", x: 20, y: 16 },
      { role: "DEF", label: "CB", x: 17, y: 39 },
      { role: "DEF", label: "CB", x: 17, y: 61 },
      { role: "DEF", label: "RB", x: 20, y: 84 },
      { role: "MID", label: "LM", x: 38, y: 16 },
      { role: "MID", label: "CM", x: 35, y: 39 },
      { role: "MID", label: "CM", x: 35, y: 61 },
      { role: "MID", label: "RM", x: 38, y: 84 },
      { role: "ATT", label: "ST", x: 52, y: 40 },
      { role: "ATT", label: "ST", x: 52, y: 60 },
    ],
  },
  "4-3-3": {
    name: "4-3-3",
    blurb: "Balanced, dangerous wide",
    attack: 3,
    midfield: 2,
    defence: 1,
    slots: [
      { role: "GK", label: "GK", x: 5, y: 50 },
      { role: "DEF", label: "LB", x: 20, y: 16 },
      { role: "DEF", label: "CB", x: 17, y: 39 },
      { role: "DEF", label: "CB", x: 17, y: 61 },
      { role: "DEF", label: "RB", x: 20, y: 84 },
      { role: "MID", label: "CM", x: 34, y: 30 },
      { role: "MID", label: "CM", x: 31, y: 50 },
      { role: "MID", label: "CM", x: 34, y: 70 },
      { role: "ATT", label: "LW", x: 53, y: 18 },
      { role: "ATT", label: "ST", x: 55, y: 50 },
      { role: "ATT", label: "RW", x: 53, y: 82 },
    ],
  },
  "4-2-3-1": {
    name: "4-2-3-1",
    blurb: "Central buildup, sharp counters",
    attack: 2,
    midfield: 4,
    defence: 2,
    slots: [
      { role: "GK", label: "GK", x: 5, y: 50 },
      { role: "DEF", label: "LB", x: 20, y: 16 },
      { role: "DEF", label: "CB", x: 17, y: 39 },
      { role: "DEF", label: "CB", x: 17, y: 61 },
      { role: "DEF", label: "RB", x: 20, y: 84 },
      { role: "MID", label: "DM", x: 29, y: 40 },
      { role: "MID", label: "DM", x: 29, y: 60 },
      { role: "MID", label: "LAM", x: 44, y: 20 },
      { role: "MID", label: "CAM", x: 44, y: 50 },
      { role: "MID", label: "RAM", x: 44, y: 80 },
      { role: "ATT", label: "ST", x: 56, y: 50 },
    ],
  },
  "5-3-2": {
    name: "5-3-2",
    blurb: "Low block, hard to break",
    attack: -2,
    midfield: 1,
    defence: 6,
    slots: [
      { role: "GK", label: "GK", x: 5, y: 50 },
      { role: "DEF", label: "LWB", x: 22, y: 10 },
      { role: "DEF", label: "CB", x: 16, y: 30 },
      { role: "DEF", label: "CB", x: 14, y: 50 },
      { role: "DEF", label: "CB", x: 16, y: 70 },
      { role: "DEF", label: "RWB", x: 22, y: 90 },
      { role: "MID", label: "CM", x: 34, y: 28 },
      { role: "MID", label: "CM", x: 32, y: 50 },
      { role: "MID", label: "CM", x: 34, y: 72 },
      { role: "ATT", label: "ST", x: 50, y: 40 },
      { role: "ATT", label: "ST", x: 50, y: 60 },
    ],
  },
};

const HOME_NAMES = [
  "John Jaques",
  "Elton Praise",
  "Corbin Weeks",
  "Marlo Denning",
  "Otis Vandermeer",
  "Rudy Salcombe",
  "Jackson Maynor",
  "Teddy Ravenhill",
  "Nico Brambell",
  "Wes Harlowe",
  "Dex Fontaine",
];
const AWAY_NAMES = [
  "Gus Merrivale",
  "Lonnie Barkfield",
  "Percy Stallard",
  "Abel Crowhurst",
  "Milo Sandgrove",
  "Ronan Pike",
  "Vance Ottoway",
  "Casper Lund",
  "Emmet Doyle",
  "Rex Callahan",
  "Sonny Ferris",
];

const HOME_BENCH_NAMES = [
  "Gil Ashcombe",
  "Ike Rothwell",
  "Sammy Quill",
  "Bruno Feldt",
  "Ozzy Trenton",
];
const AWAY_BENCH_NAMES = [
  "Hal Winstone",
  "Freddie Mott",
  "Ivo Carraway",
  "Ned Balfour",
  "Kit Osgood",
];

function rnd(min: number, max: number, seed: () => number) {
  return Math.round(min + seed() * (max - min));
}

export function mulberry(seed: number) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function ratingsFor(role: Role, r: () => number): Ratings {
  const base: Ratings = {
    shooting: rnd(45, 65, r),
    passing: rnd(55, 72, r),
    dribbling: rnd(50, 70, r),
    interception: rnd(50, 70, r),
    tackling: rnd(50, 70, r),
    pace: rnd(58, 82, r),
    strength: rnd(55, 80, r),
    positioning: rnd(55, 75, r),
    stamina: rnd(65, 90, r),
    composure: rnd(55, 78, r),
    vision: rnd(50, 72, r),
  };
  if (role === "GK") {
    base.positioning = rnd(78, 90, r);
    base.composure = rnd(74, 88, r);
    base.interception = rnd(70, 85, r);
    base.strength = rnd(72, 86, r);
  }
  if (role === "DEF") {
    base.tackling = rnd(74, 89, r);
    base.strength = rnd(72, 90, r);
    base.positioning = rnd(72, 88, r);
    base.interception = rnd(70, 86, r);
  }
  if (role === "MID") {
    base.passing = rnd(74, 90, r);
    base.vision = rnd(72, 89, r);
    base.interception = rnd(66, 82, r);
    base.stamina = rnd(78, 94, r);
  }
  if (role === "ATT") {
    base.shooting = rnd(74, 90, r);
    base.dribbling = rnd(74, 91, r);
    base.pace = rnd(76, 93, r);
    base.composure = rnd(70, 88, r);
  }
  return base;
}

export const GK_STYLES: GkStyle[] = ["Shot Stopper", "Sweeper Keeper", "Commanding", "Distributor"];

export function buildSquad(
  side: "home" | "away",
  formation: FormationName,
  seed: number,
): Player[] {
  const r = mulberry(seed);
  const names = side === "home" ? HOME_NAMES : AWAY_NAMES;
  const club = side === "home" ? "Ballers FC" : "Rival United";
  return FORMATIONS[formation]!.slots.map((slot: Slot, i) => ({
    id: `${side}-${i}`,
    name: names[i]!,
    num: i === 0 ? 1 : i + 1,
    role: slot.role,
    label: slot.label,
    club,
    ratings: ratingsFor(slot.role, r),
    ...(slot.role === "GK"
      ? { gkStyle: GK_STYLES[Math.floor(r() * GK_STYLES.length)]! }
      : {}),
    stamina: 100,
  }));
}

const BENCH_ROLES: Role[] = ["DEF", "MID", "MID", "ATT", "GK"];

/** Five substitutes per team, seeded off the starting XI seed. */
export function buildBench(side: "home" | "away", seed: number): Player[] {
  const r = mulberry(seed + 991);
  const names = side === "home" ? HOME_BENCH_NAMES : AWAY_BENCH_NAMES;
  const club = side === "home" ? "Ballers FC" : "Rival United";
  return BENCH_ROLES.map((role, i) => ({
    id: `${side}-sub-${i}`,
    name: names[i]!,
    num: 12 + i,
    role,
    label: role === "GK" ? "GK" : role === "DEF" ? "CB" : role === "MID" ? "CM" : "ST",
    club,
    ratings: ratingsFor(role, r),
    ...(role === "GK" ? { gkStyle: GK_STYLES[Math.floor(r() * GK_STYLES.length)]! } : {}),
    stamina: 100,
  }));
}

/** Keeps player identities but re-labels/re-positions them for a new formation. */
export function reshape(players: Player[], formation: FormationName): Player[] {
  const slots = FORMATIONS[formation]!.slots;
  const pool = [...players];
  const gk = pool.shift()!;
  const byRole = (role: Role) => {
    const idx = pool.findIndex((p) => p.role === role);
    return idx >= 0 ? pool.splice(idx, 1)[0]! : pool.shift()!;
  };
  const out: Player[] = [{ ...gk, label: "GK", role: "GK" }];
  slots.slice(1).forEach((slot) => {
    const p = byRole(slot.role);
    out.push({ ...p, label: slot.label, role: slot.role });
  });
  return out;
}

export const TACTIC_INFO: Record<
  string,
  { name: string; desc: string; side: "attack" | "defence" }
> = {
  "high-press": {
    name: "High Press",
    desc: "+8 tackling & interception, drains stamina",
    side: "defence",
  },
  counter: { name: "Counterattack", desc: "+10 pace after winning the ball", side: "attack" },
  "tiki-taka": { name: "Tiki-Taka", desc: "+10 passing & vision on chains", side: "attack" },
  "park-the-bus": { name: "Park the Bus", desc: "+12 defence, -8 attack", side: "defence" },
  "long-ball": { name: "Long Ball", desc: "Skip a line, tests pace & strength", side: "attack" },
  overlap: { name: "Overlap", desc: "+9 dribbling and crossing wide", side: "attack" },
};

/** Single headline number for a player, used for pricing and squad lists. */
export function overall(p: Player): number {
  const r = p.ratings;
  const avg =
    p.role === "GK"
      ? (r.positioning + r.composure + r.interception + r.strength) / 4
      : p.role === "DEF"
        ? (r.tackling + r.positioning + r.strength + r.interception + r.pace) / 5
        : p.role === "MID"
          ? (r.passing + r.vision + r.interception + r.stamina + r.dribbling) / 5
          : (r.shooting + r.dribbling + r.pace + r.composure + r.passing) / 5;
  return Math.round(avg);
}
