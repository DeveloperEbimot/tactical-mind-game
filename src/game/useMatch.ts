import { useCallback, useRef, useState } from "react";
import { buildSquad, reshape, FORMATIONS } from "./data";
import {
  gkSaveBonus,
  pickAiAction,
  pickAiResponse,
  resolveBattle,
  shotChance,
} from "./engine";
import type {
  AttackAction,
  DefenceResponse,
  FormationName,
  LogEntry,
  Phase,
  Player,
  Side,
  TacticCard,
  TeamState,
} from "./types";

export type ShotDir = "left" | "centre" | "right";

function makeTeam(side: Side, formation: FormationName, seed: number): TeamState {
  return {
    side,
    name: side === "home" ? "Ballers FC" : "Rival United",
    short: side === "home" ? "BAL" : "RIV",
    formation,
    players: buildSquad(side, formation, seed),
    score: 0,
    tacticsLeft: 3,
    activeTactic: null,
    formationChangesLeft: 2,
  };
}

function pickDefenderIndex(team: TeamState, chain: number) {
  const wanted = chain <= 0 ? ["ATT", "MID"] : chain === 1 ? ["MID", "DEF"] : ["DEF"];
  const pool = team.players
    .map((p, i) => ({ p, i }))
    .filter(({ p }) => wanted.includes(p.role) && p.stamina > 5);
  if (pool.length === 0) return 3;
  const a = pool[Math.floor(Math.random() * pool.length)];
  const b = pool[Math.floor(Math.random() * pool.length)];
  return a.p.stamina >= b.p.stamina ? a.i : b.i;
}

function nextReceiver(team: TeamState, carrierIdx: number) {
  const options = team.players
    .map((p, i) => ({ p, i }))
    .filter(({ p, i }) => i !== carrierIdx && p.role !== "GK");
  options.sort(
    (x, y) =>
      y.p.ratings.pace + y.p.stamina * 0.3 - (x.p.ratings.pace + x.p.stamina * 0.3),
  );
  const top = options.slice(0, 4);
  return top[Math.floor(Math.random() * top.length)].i;
}

export interface MatchState {
  home: TeamState;
  away: TeamState;
  possession: Side;
  carrierIdx: number;
  defenderIdx: number;
  progress: number; // 0-100 towards the defending goal
  lane: number; // y position of the ball 10-90
  chain: number;
  phase: Phase;
  minute: number;
  momentum: number; // + favours home
  log: LogEntry[];
  pendingAction: AttackAction | null;
  pendingShotDir: ShotDir | null;
  lastChance: number | null;
  banner: string | null;
}

const HUMAN: Side = "home";

export function useMatch() {
  const logId = useRef(0);
  const [state, setState] = useState<MatchState>(() => ({
    home: makeTeam("home", "4-3-3", 7),
    away: makeTeam("away", "4-4-2", 42),
    possession: "home",
    carrierIdx: 9,
    defenderIdx: 3,
    progress: 46,
    lane: 50,
    chain: 0,
    phase: "choose-action",
    minute: 1,
    momentum: 0,
    log: [{ id: 0, kind: "info", text: "Kick off. Ballers FC get the ball." }],
    pendingAction: null,
    pendingShotDir: null,
    lastChance: null,
    banner: null,
  }));

  const push = (s: MatchState, text: string, kind: LogEntry["kind"] = "info"): MatchState => ({
    ...s,
    log: [{ id: ++logId.current, text, kind }, ...s.log].slice(0, 40),
  });

  const drain = (team: TeamState, idx: number, amount: number): TeamState => ({
    ...team,
    players: team.players.map((p, i) =>
      i === idx ? { ...p, stamina: Math.max(0, p.stamina - amount) } : p,
    ),
  });

  const turnover = (s: MatchState, reason: string): MatchState => {
    const newSide: Side = s.possession === "home" ? "away" : "home";
    const team = newSide === "home" ? s.home : s.away;
    const carrier = nextReceiver(team, 0);
    let next: MatchState = {
      ...s,
      possession: newSide,
      carrierIdx: carrier,
      chain: 0,
      progress: 40,
      lane: 30 + Math.random() * 40,
      pendingAction: null,
      pendingShotDir: null,
      lastChance: null,
      momentum: Math.max(-100, Math.min(100, s.momentum + (newSide === "home" ? 12 : -12))),
      minute: s.minute + 2,
      phase: "resolve",
      banner: reason,
    };
    next = push(next, reason, newSide === HUMAN ? "good" : "bad");
    return next;
  };

  const scoreGoal = (s: MatchState): MatchState => {
    const scorerSide = s.possession;
    const team = scorerSide === "home" ? s.home : s.away;
    const scorer = team.players[s.carrierIdx];
    let next: MatchState = {
      ...s,
      home: scorerSide === "home" ? { ...s.home, score: s.home.score + 1 } : s.home,
      away: scorerSide === "away" ? { ...s.away, score: s.away.score + 1 } : s.away,
      momentum: scorerSide === "home" ? 40 : -40,
      minute: s.minute + 2,
      phase: "resolve",
      banner: `GOAL! ${scorer.name} scores for ${team.short}`,
      pendingAction: null,
      pendingShotDir: null,
    };
    next = push(next, `GOAL — ${scorer.name} (${team.short}) finishes it.`, "goal");
    // opponent kicks off
    const other: Side = scorerSide === "home" ? "away" : "home";
    const otherTeam = other === "home" ? next.home : next.away;
    next = {
      ...next,
      possession: other,
      carrierIdx: nextReceiver(otherTeam, 0),
      progress: 38,
      lane: 50,
      chain: 0,
    };
    return next;
  };

  const finishIfDone = (s: MatchState): MatchState =>
    s.minute >= 90 ? push({ ...s, phase: "fulltime", banner: "Full time" }, "Full time.", "info") : s;

  /** Human attacking: pick an action. */
  const chooseAction = useCallback((action: AttackAction) => {
    setState((s) => {
      if (s.phase !== "choose-action" || s.possession !== HUMAN) return s;
      const defIdx = pickDefenderIndex(s.away, s.chain);
      if (action === "shoot") {
        return {
          ...s,
          pendingAction: action,
          defenderIdx: defIdx,
          phase: "shot-aim",
          lastChance: shotChance(s.home.players[s.carrierIdx], s.progress, s.home.activeTactic),
          banner: null,
        };
      }
      const response = pickAiResponse(action);
      return resolveDuel(s, action, response, defIdx, "home");
    });
  }, []);

  /** Human defending: pick a response to the AI's hidden action. */
  const chooseResponse = useCallback((response: DefenceResponse) => {
    setState((s) => {
      if (s.phase !== "choose-response" || !s.pendingAction) return s;
      return resolveDuel(s, s.pendingAction, response, s.defenderIdx, "away");
    });
  }, []);

  function resolveDuel(
    s: MatchState,
    action: AttackAction,
    response: DefenceResponse,
    defIdx: number,
    attackingSide: Side,
  ): MatchState {
    const atkTeam = attackingSide === "home" ? s.home : s.away;
    const defTeam = attackingSide === "home" ? s.away : s.home;
    const attacker = atkTeam.players[s.carrierIdx];
    const defender = defTeam.players[defIdx];
    const res = resolveBattle({
      action,
      response,
      attacker,
      defender,
      attackFormation: atkTeam.formation,
      defenceFormation: defTeam.formation,
      attackTactic: atkTeam.activeTactic,
      defenceTactic: defTeam.activeTactic,
      momentum: attackingSide === "home" ? s.momentum : -s.momentum,
      chain: s.chain,
    });

    let next: MatchState = { ...s, defenderIdx: defIdx, pendingAction: null };
    // stamina cost
    const cost = action === "sprint" ? 9 : 5;
    if (attackingSide === "home") {
      next.home = drain(next.home, s.carrierIdx, cost);
      next.away = drain(next.away, defIdx, response === "press" ? 7 : 4);
    } else {
      next.away = drain(next.away, s.carrierIdx, cost);
      next.home = drain(next.home, defIdx, response === "press" ? 7 : 4);
    }

    const label = `${attacker.name} ${action}s at ${defender.label} ${defender.name} (${response})`;

    if (res.won) {
      const gain = action === "sprint" ? 20 : action === "pass" ? 16 : 13;
      const newProgress = Math.min(95, s.progress + gain);
      let carrier = s.carrierIdx;
      if (action === "pass") carrier = nextReceiver(atkTeam, s.carrierIdx);
      next = {
        ...next,
        carrierIdx: carrier,
        progress: newProgress,
        lane: Math.max(8, Math.min(92, s.lane + (Math.random() - 0.5) * 26)),
        chain: s.chain + 1,
        minute: s.minute + 1,
        momentum: Math.max(
          -100,
          Math.min(100, s.momentum + (attackingSide === "home" ? 8 : -8)),
        ),
        phase: "resolve",
        banner: `${label} — beaten! Attack advances.`,
      };
      next = push(next, `${label} — success.`, attackingSide === HUMAN ? "good" : "bad");
      return finishIfDone(next);
    }

    next = { ...next, progress: s.progress };
    next = turnover(next, `${label} — stopped. Possession lost.`);
    return finishIfDone(next);
  }

  /** Human shooting: pick a side. */
  const takeShot = useCallback((dir: ShotDir) => {
    setState((s) => {
      if (s.phase !== "shot-aim") return s;
      const keeperDive = (["left", "centre", "right"] as ShotDir[])[Math.floor(Math.random() * 3)];
      return resolveShot(s, dir, keeperDive, "home");
    });
  }, []);

  /** Human keeping: pick a dive against the AI's hidden shot. */
  const diveShot = useCallback((dir: ShotDir) => {
    setState((s) => {
      if (s.phase !== "shot-dive" || !s.pendingShotDir) return s;
      return resolveShot(s, s.pendingShotDir, dir, "away");
    });
  }, []);

  function resolveShot(
    s: MatchState,
    shotDir: ShotDir,
    diveDir: ShotDir,
    attackingSide: Side,
  ): MatchState {
    const atkTeam = attackingSide === "home" ? s.home : s.away;
    const defTeam = attackingSide === "home" ? s.away : s.home;
    const shooter = atkTeam.players[s.carrierIdx];
    const gk = defTeam.players[0];
    const chance = s.lastChance ?? shotChance(shooter, s.progress, atkTeam.activeTactic);
    const roll = Math.random() * 100;

    let next: MatchState = { ...s, pendingShotDir: null, pendingAction: null };
    next =
      attackingSide === "home"
        ? { ...next, home: drain(next.home, s.carrierIdx, 6) }
        : { ...next, away: drain(next.away, s.carrierIdx, 6) };

    if (roll > chance) {
      // Off target: 50/50 clean miss vs deflection off a defender
      if (Math.random() < 0.5) {
        next = push(
          next,
          `${shooter.name} shoots (${chance}% chance) — wide. Goal kick.`,
          attackingSide === HUMAN ? "bad" : "good",
        );
        return finishIfDone(turnover(next, `${shooter.name} misses the target.`));
      }
      const back = Math.random() < 0.5;
      if (back) {
        const carrier = nextReceiver(atkTeam, s.carrierIdx);
        next = push(
          next,
          `${shooter.name}'s shot deflects off a defender — it falls back to ${atkTeam.short}!`,
          attackingSide === HUMAN ? "good" : "bad",
        );
        return finishIfDone({
          ...next,
          carrierIdx: carrier,
          chain: 0,
          progress: Math.max(60, s.progress - 10),
          minute: s.minute + 1,
          phase: "resolve",
          banner: "Deflected — loose ball, attack keeps it!",
        });
      }
      next = push(next, `${shooter.name}'s shot is blocked and cleared.`, "info");
      return finishIfDone(turnover(next, "Blocked by the defender — cleared."));
    }

    // On target — keeper guess decides it
    const correct = diveDir === shotDir;
    const saveScore = 55 + gkSaveBonus(gk, correct) * 3;
    const saved = correct && Math.random() * 100 < saveScore;
    if (saved) {
      next = push(
        next,
        `SAVED! ${gk.name} (${gk.gkStyle}) guesses ${diveDir} and keeps out ${shooter.name}.`,
        attackingSide === HUMAN ? "bad" : "good",
      );
      return finishIfDone(turnover(next, `${gk.name} saves it — ${diveDir}!`));
    }
    next = push(
      next,
      `${shooter.name} shoots ${shotDir} (${chance}% chance) — keeper went ${diveDir}.`,
      attackingSide === HUMAN ? "good" : "bad",
    );
    return finishIfDone(scoreGoal(next));
  }

  /** Advance to the next decision — runs the AI turn when it has the ball. */
  const nextBeat = useCallback(() => {
    setState((s) => {
      if (s.phase === "fulltime") return s;
      if (s.possession === HUMAN) {
        return { ...s, phase: "choose-action", banner: null };
      }
      const carrier = s.away.players[s.carrierIdx];
      const action = pickAiAction(s.progress, carrier);
      if (action === "shoot") {
        const dir = (["left", "centre", "right"] as ShotDir[])[Math.floor(Math.random() * 3)];
        return {
          ...s,
          pendingShotDir: dir,
          pendingAction: "shoot",
          lastChance: shotChance(carrier, s.progress, s.away.activeTactic),
          phase: "shot-dive",
          banner: `${carrier.name} shoots! Pick your dive.`,
        };
      }
      return {
        ...s,
        pendingAction: action,
        defenderIdx: pickDefenderIndex(s.home, s.chain),
        phase: "choose-response",
        banner: `${carrier.name} is on the ball — read him.`,
      };
    });
  }, []);

  const playTactic = useCallback((tactic: TacticCard) => {
    setState((s) => {
      if (s.home.tacticsLeft <= 0) return s;
      return push(
        {
          ...s,
          home: { ...s.home, tacticsLeft: s.home.tacticsLeft - 1, activeTactic: tactic },
        },
        `Tactic played: ${tactic.replace(/-/g, " ")}.`,
        "info",
      );
    });
  }, []);

  const changeFormation = useCallback((formation: FormationName) => {
    setState((s) => {
      if (s.home.formationChangesLeft <= 0 || s.home.formation === formation) return s;
      const players = reshape(s.home.players, formation);
      return push(
        {
          ...s,
          home: {
            ...s.home,
            formation,
            players,
            formationChangesLeft: s.home.formationChangesLeft - 1,
          },
          minute: s.minute + 1,
        },
        `Shape switched to ${formation} (${FORMATIONS[formation].blurb}).`,
        "info",
      );
    });
  }, []);

  const restart = useCallback(() => {
    logId.current = 0;
    setState({
      home: makeTeam("home", "4-3-3", Math.floor(Math.random() * 9999)),
      away: makeTeam("away", "4-4-2", Math.floor(Math.random() * 9999)),
      possession: "home",
      carrierIdx: 9,
      defenderIdx: 3,
      progress: 46,
      lane: 50,
      chain: 0,
      phase: "choose-action",
      minute: 1,
      momentum: 0,
      log: [{ id: 0, kind: "info", text: "Kick off. Ballers FC get the ball." }],
      pendingAction: null,
      pendingShotDir: null,
      lastChance: null,
      banner: null,
    });
  }, []);

  const carrier: Player =
    state.possession === "home"
      ? state.home.players[state.carrierIdx]
      : state.away.players[state.carrierIdx];
  const defender: Player =
    state.possession === "home"
      ? state.away.players[state.defenderIdx]
      : state.home.players[state.defenderIdx];

  return {
    state,
    carrier,
    defender,
    chooseAction,
    chooseResponse,
    takeShot,
    diveShot,
    nextBeat,
    playTactic,
    changeFormation,
    restart,
  };
}
