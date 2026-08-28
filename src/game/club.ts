import { useCallback, useEffect, useState } from "react";
import { GK_STYLES, mulberry, overall, ratingsFor } from "./data";
import type { FormationName, Mentality, Player, Role } from "./types";

export interface ClubProfile {
  name: string;
  short: string;
  balance: number;
  formation: FormationName;
  mentality: Mentality;
  /** Players bought from the market — they join the bench. */
  signings: Player[];
  sold: string[];
  played: number;
  won: number;
  drawn: number;
  lost: number;
  settings: {
    animationSpeed: "slow" | "normal" | "fast";
    showHints: boolean;
  };
}

export const DEFAULT_CLUB: ClubProfile = {
  name: "Ballers FC",
  short: "BAL",
  balance: 12_500_000,
  formation: "4-3-3",
  mentality: "balanced",
  signings: [],
  sold: [],
  played: 0,
  won: 0,
  drawn: 0,
  lost: 0,
  settings: { animationSpeed: "normal", showHints: true },
};

const KEY = "ballers.club.v1";

export function loadClub(): ClubProfile {
  if (typeof window === "undefined") return DEFAULT_CLUB;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return DEFAULT_CLUB;
    const parsed = JSON.parse(raw) as Partial<ClubProfile>;
    return {
      ...DEFAULT_CLUB,
      ...parsed,
      settings: { ...DEFAULT_CLUB.settings, ...(parsed.settings ?? {}) },
      signings: parsed.signings ?? [],
      sold: parsed.sold ?? [],
    };
  } catch {
    return DEFAULT_CLUB;
  }
}

export function saveClub(club: ClubProfile) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(KEY, JSON.stringify(club));
}

/** Reads from localStorage after mount so SSR and hydration agree. */
export function useClub() {
  const [club, setClub] = useState<ClubProfile>(DEFAULT_CLUB);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setClub(loadClub());
    setReady(true);
  }, []);

  const update = useCallback((patch: Partial<ClubProfile> | ((c: ClubProfile) => ClubProfile)) => {
    setClub((prev) => {
      const next = typeof patch === "function" ? patch(prev) : { ...prev, ...patch };
      saveClub(next);
      return next;
    });
  }, []);

  const reset = useCallback(() => {
    saveClub(DEFAULT_CLUB);
    setClub(DEFAULT_CLUB);
  }, []);

  return { club, ready, update, reset };
}

export const money = (n: number) =>
  n >= 1_000_000
    ? `€${(n / 1_000_000).toFixed(n >= 10_000_000 ? 1 : 2)}M`
    : `€${Math.round(n / 1000)}K`;

const FIRST = [
  "Aldo",
  "Bram",
  "Cyrus",
  "Dario",
  "Emrys",
  "Faron",
  "Gideon",
  "Hollis",
  "Ivor",
  "Jonas",
  "Kelvin",
  "Lucien",
  "Marek",
  "Noel",
  "Osian",
  "Pascal",
  "Quinn",
  "Rafe",
  "Silas",
  "Tobias",
];
const LAST = [
  "Ashgrove",
  "Bellweather",
  "Corrigan",
  "Dunmore",
  "Ellery",
  "Falkirk",
  "Grieveson",
  "Hartnell",
  "Isley",
  "Jarrow",
  "Kestrel",
  "Lindqvist",
  "Marchetti",
  "Norwood",
  "Ovaldi",
  "Prendergast",
  "Rookwood",
  "Sandoval",
  "Thackeray",
  "Vasquez",
];
const CLUBS = [
  "Free agent",
  "Vale Rangers",
  "Port Harrow",
  "Kingsmere",
  "Estrela CF",
  "Nordvik IF",
  "Real Cañada",
];

export interface MarketPlayer extends Player {
  price: number;
  ovr: number;
}

const MARKET_ROLES: Role[] = [
  "ATT",
  "ATT",
  "ATT",
  "MID",
  "MID",
  "MID",
  "MID",
  "DEF",
  "DEF",
  "DEF",
  "GK",
  "GK",
];

/** A deterministic transfer market — the same shop every session, so saved money means something. */
export function buildMarket(seed = 20260828): MarketPlayer[] {
  const r = mulberry(seed);
  return MARKET_ROLES.map((role, i) => {
    const ratings = ratingsFor(role, r);
    const boost = Math.round(r() * 10);
    (Object.keys(ratings) as (keyof typeof ratings)[]).forEach((k) => {
      ratings[k] = Math.min(96, ratings[k] + boost);
    });
    const player: Player = {
      id: `mkt-${i}`,
      name: `${FIRST[Math.floor(r() * FIRST.length)]} ${LAST[Math.floor(r() * LAST.length)]}`,
      num: 20 + i,
      role,
      label: role === "GK" ? "GK" : role === "DEF" ? "CB" : role === "MID" ? "CM" : "ST",
      club: CLUBS[Math.floor(r() * CLUBS.length)]!,
      ratings,
      ...(role === "GK" ? { gkStyle: GK_STYLES[Math.floor(r() * GK_STYLES.length)]! } : {}),
      stamina: 100,
    };
    const ovr = overall(player);
    const price = Math.round((Math.pow(ovr - 55, 2.1) * 9000 + 250_000) / 50_000) * 50_000;
    return { ...player, ovr, price };
  });
}

export const sellValue = (p: Player) => Math.round(Math.pow(overall(p) - 55, 2.1) * 5000 + 120_000);
