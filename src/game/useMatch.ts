import { useEffect, useRef, useState } from "react";
import { buildSquad, reshape, FORMATIONS } from "./data";
import { gkSaveBonus, pickAiAction, pickAiResponse, shotChance } from "./engine";
import { buildPositions, distToSegment, type Pt } from "./positions";
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
export type PenDir = "left" | "right" | "chip";
export type DiveDir = "left" | "right" | "stay";

const HUMAN: Side = "home";
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

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

export interface MatchState {
  home: TeamState;
  away: TeamState;
  possession: Side;
  carrierIdx: number;
  defenderIdx: number;
  progress: number;
  lane: number;
  chain: number;
  phase: Phase;
  minute: number;
  momentum: number;
  log: LogEntry[];
  pendingAction: AttackAction | null;
  pendingTarget: number | null;
  pendingShotDir: ShotDir | null;
  pendingPen: PenDir | null;
  penaltyFor: Side | null;
  lastChance: number | null;
  banner: string | null;
  ball: Pt;
  ballSpeed: number;
  /** While the ball is in flight the carrier stays put here instead of riding the ball. */
  carrierAnchor: Pt | null;
  passTargets: number[] | null;
}

/** 70/30 style outcome odds — running at a man is about the read, not the ratings. */
const RUN_ODDS: Record<"dribble" | "sprint", Record<DefenceResponse, { win: number; foul: number }>> =
  {
    dribble: {
      press: { win: 0.6, foul: 0.15 },
      tackle: { win: 0.7, foul: 0.3 },
      cover: { win: 0.85, foul: 0.05 },
      drop: { win: 0.75, foul: 0.05 },
    },
    sprint: {
      press: { win: 0.45, foul: 0.2 },
      tackle: { win: 1, foul: 0 },
      cover: { win: 0.8, foul: 0.05 },
      drop: { win: 0.25, foul: 0.1 },
    },
  };

const PASS_RADIUS: Record<DefenceResponse, number> = { cover: 11, drop: 8.5, press: 6.5, tackle: 6 };

function ballAtRest(s: {
  possession: Side;
  progress: number;
  lane: number;
}): Pt {
  return { x: s.possession === "home" ? s.progress : 100 - s.progress, y: s.lane };
}

/** Travel time so short passes feel snappy and long balls actually hang. */
function flightTime(from: Pt, to: Pt, perUnit = 22, lo = 420, hi = 1100) {
  return clamp(Math.round(Math.hypot(to.x - from.x, to.y - from.y) * perUnit), lo, hi);
}

export function positionsFor(s: MatchState) {
  const home = buildPositions({
    team: s.home,
    side: "home",
    attacking: s.possession === "home",
    carrierIdx: s.carrierIdx,
    defenderIdx: s.defenderIdx,
    ballX: s.ball.x,
    ballY: s.ball.y,
    progress: s.progress,
    carrierAnchor: s.carrierAnchor,
  });
  const away = buildPositions({
    team: s.away,
    side: "away",
    attacking: s.possession === "away",
    carrierIdx: s.carrierIdx,
    defenderIdx: s.defenderIdx,
    ballX: s.ball.x,
    ballY: s.ball.y,
    progress: s.progress,
    carrierAnchor: s.carrierAnchor,
  });
  return { home, away };
}

function pickDefenderIndex(team: TeamState, chain: number) {
  const wanted = chain <= 0 ? ["ATT", "MID"] : chain === 1 ? ["MID", "DEF"] : ["DEF"];
  const pool = team.players
    .map((p, i) => ({ p, i }))
    .filter(({ p }) => wanted.includes(p.role) && p.stamina > 5);
  if (pool.length === 0) return 3;
  return pool[Math.floor(Math.random() * pool.length)]!.i;
}

function progressFromX(side: Side, x: number) {
  return clamp(side === "home" ? x : 100 - x, 5, 96);
}

function initial(seedA: number, seedB: number): MatchState {
  const base = {
    home: makeTeam("home", "4-3-3", seedA),
    away: makeTeam("away", "4-4-2", seedB),
    possession: "home" as Side,
    carrierIdx: 6,
    defenderIdx: 9,
    progress: 46,
    lane: 50,
    chain: 0,
    phase: "kickoff" as Phase,
    minute: 1,
    momentum: 0,
    log: [{ id: 0, kind: "info" as const, text: "Teams are out. Tap Kick off." }],
    pendingAction: null,
    pendingTarget: null,
    pendingShotDir: null,
    pendingPen: null,
    penaltyFor: null,
    lastChance: null,
    banner: "Kick off — get it rolling.",
    ballSpeed: 500,
    carrierAnchor: null,
    passTargets: null,
  };
  return { ...base, ball: { x: 50, y: 50 } };
}

export function useMatch() {
  const logId = useRef(0);
  const timers = useRef<number[]>([]);
  const [state, setState] = useState<MatchState>(() => initial(7, 42));
  const ref = useRef(state);
  useEffect(() => {
    ref.current = state;
  }, [state]);
  useEffect(() => () => timers.current.forEach((t) => clearTimeout(t)), []);

  type Step = { delay: number; patch: (s: MatchState) => MatchState };

  const run = (steps: Step[]) => {
    timers.current.forEach((t) => clearTimeout(t));
    timers.current = [];
    let t = 0;
    for (const step of steps) {
      t += step.delay;
      if (t === 0) {
        setState((s) => step.patch(s));
      } else {
        timers.current.push(
          window.setTimeout(() => setState((s) => step.patch(s)), t) as unknown as number,
        );
      }
    }
  };

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

  const finishIfDone = (s: MatchState): MatchState =>
    s.minute >= 90
      ? push({ ...s, phase: "fulltime", banner: "Full time" }, "Full time.", "info")
      : s;

  const settle = (s: MatchState): MatchState => ({
    ...s,
    ball: ballAtRest(s),
    carrierAnchor: null,
    passTargets: null,
    ballSpeed: 520,
  });

  function turnover(s: MatchState, reason: string, newCarrier?: number): MatchState {
    const newSide: Side = s.possession === "home" ? "away" : "home";
    const team = newSide === "home" ? s.home : s.away;
    const carrier =
      newCarrier ?? team.players.map((p, i) => ({ p, i })).filter(({ p }) => p.role === "MID")[0]!.i;
    const next: MatchState = {
      ...s,
      possession: newSide,
      carrierIdx: carrier,
      defenderIdx: pickDefenderIndex(newSide === "home" ? s.away : s.home, 0),
      chain: 0,
      progress: 42,
      lane: clamp(s.lane, 20, 80),
      pendingAction: null,
      pendingTarget: null,
      pendingShotDir: null,
      pendingPen: null,
      penaltyFor: null,
      lastChance: null,
      momentum: clamp(s.momentum + (newSide === "home" ? 12 : -12), -100, 100),
      minute: s.minute + 2,
      phase: "resolve",
      banner: reason,
    };
    return finishIfDone(settle(push(next, reason, newSide === HUMAN ? "good" : "bad")));
  }

  function scoreGoal(s: MatchState, scorer: Player): MatchState {
    const scorerSide = s.possession;
    const team = scorerSide === "home" ? s.home : s.away;
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
      pendingPen: null,
      penaltyFor: null,
    };
    next = push(next, `GOAL — ${scorer.name} (${team.short}) finishes it.`, "goal");
    const other: Side = scorerSide === "home" ? "away" : "home";
    const otherTeam = other === "home" ? next.home : next.away;
    next = {
      ...next,
      possession: other,
      carrierIdx: otherTeam.players.findIndex((p) => p.role === "MID"),
      progress: 44,
      lane: 50,
      chain: 0,
    };
    return finishIfDone(settle(next));
  }

  // ---------------- passing ----------------

  function passOutcome(
    s: MatchState,
    attackingSide: Side,
    targetIdx: number,
    response: DefenceResponse,
  ) {
    const pos = positionsFor(s);
    const atkPos = attackingSide === "home" ? pos.home : pos.away;
    const defPos = attackingSide === "home" ? pos.away : pos.home;
    const defTeam = attackingSide === "home" ? s.away : s.home;
    const from = atkPos[s.carrierIdx]!;
    const to = atkPos[targetIdx]!;
    const radius = PASS_RADIUS[response];
    let best: { idx: number; point: Pt; dist: number } | null = null;
    defPos.forEach((p, i) => {
      if (defTeam.players[i]!.role === "GK") return;
      const { dist, t, point } = distToSegment(p, from, to);
      if (t < 0.08 || t > 0.96) return;
      if (dist > radius) return;
      if (!best || dist < best.dist) best = { idx: i, point, dist };
    });
    return { from, to, cut: best as { idx: number; point: Pt; dist: number } | null };
  }

  function resolvePass(
    s0: MatchState,
    attackingSide: Side,
    targetIdx: number,
    response: DefenceResponse,
  ) {
    const { to, cut } = passOutcome(s0, attackingSide, targetIdx, response);
    const atkTeam = attackingSide === "home" ? s0.home : s0.away;
    const defTeam = attackingSide === "home" ? s0.away : s0.home;
    const passer = atkTeam.players[s0.carrierIdx]!;
    const receiver = atkTeam.players[targetIdx]!;

    if (cut) {
      const thief = defTeam.players[cut.idx]!;
      const { from } = passOutcome(s0, attackingSide, targetIdx, response);
      const legOne = flightTime(from, cut.point, 26, 380, 900);
      run([
        {
          delay: 0,
          patch: (s) => ({
            ...s,
            phase: "animating",
            passTargets: null,
            carrierAnchor: from,
            ball: cut.point,
            ballSpeed: legOne,
            defenderIdx: cut.idx,
            pendingAction: null,
            pendingTarget: null,
            banner: `${passer.name} plays it towards ${receiver.name}…`,
          }),
        },
        {
          delay: legOne + 120,
          patch: (s) => ({
            ...s,
            banner: `Cut out! ${thief.label} ${thief.name} steps in.`,
          }),
        },
        {
          delay: 700,
          patch: (s) =>
            turnover(
              push(s, `${passer.name}'s pass is intercepted by ${thief.name}.`, "info"),
              `${thief.name} intercepts.`,
              cut.idx,
            ),
        },
      ]);
      return;
    }

    const { from: origin } = passOutcome(s0, attackingSide, targetIdx, response);
    const travel = flightTime(origin, to, 26, 420, 1000);
    run([
      {
        delay: 0,
        patch: (s) => ({
          ...s,
          phase: "animating",
          passTargets: null,
          carrierAnchor: origin,
          ball: to,
          ballSpeed: travel,
          pendingAction: null,
          pendingTarget: null,
          banner: `${passer.name} → ${receiver.name}`,
        }),
      },
      {
        delay: travel + 140,
        patch: (s) => {
          const next: MatchState = {
            ...s,
            carrierIdx: targetIdx,
            progress: progressFromX(attackingSide, to.x),
            lane: to.y,
            chain: s.chain + 1,
            minute: s.minute + 1,
            momentum: clamp(s.momentum + (attackingSide === "home" ? 6 : -6), -100, 100),
            phase: "resolve",
            banner: `${receiver.label} ${receiver.name} takes it in stride.`,
            defenderIdx: pickDefenderIndex(defTeam, s.chain + 1),
          };
          return finishIfDone(
            settle(push(next, `${passer.name} finds ${receiver.name}.`, attackingSide === HUMAN ? "good" : "bad")),
          );
        },
      },
    ]);
  }

  // ---------------- running at a man ----------------

  function resolveRun(
    s0: MatchState,
    action: "dribble" | "sprint",
    response: DefenceResponse,
    defIdx: number,
    attackingSide: Side,
  ) {
    const atkTeam = attackingSide === "home" ? s0.home : s0.away;
    const defTeam = attackingSide === "home" ? s0.away : s0.home;
    const attacker = atkTeam.players[s0.carrierIdx]!;
    const defender = defTeam.players[defIdx]!;
    const odds = RUN_ODDS[action][response];
    const roll = Math.random();
    const won = roll < odds.win;
    const foul = !won && roll < odds.win + odds.foul;
    const gain = action === "sprint" ? 18 : 12;
    const dir = attackingSide === "home" ? 1 : -1;
    const inBox = s0.progress + gain * 0.4 > 82;

    const advanceBall = (s: MatchState): MatchState => ({
      ...s,
      phase: "animating",
      defenderIdx: defIdx,
      pendingAction: null,
      ballSpeed: 900,
      carrierAnchor: null,
      ball: { x: clamp(s.ball.x + dir * gain * 0.6, 3, 97), y: clamp(s.ball.y + (Math.random() - 0.5) * 8, 8, 92) },
      banner: `${attacker.name} ${action === "sprint" ? "sprints at" : "takes on"} ${defender.name} — ${response}!`,
    });

    if (won) {
      run([
        { delay: 0, patch: advanceBall },
        {
          delay: 950,
          patch: (s) => {
            const progress = clamp(s0.progress + gain, 5, 95);
            const next: MatchState = {
              ...s,
              progress,
              lane: clamp(s.ball.y, 8, 92),
              chain: s.chain + 1,
              minute: s.minute + 1,
              momentum: clamp(s.momentum + (attackingSide === "home" ? 8 : -8), -100, 100),
              phase: "resolve",
              banner: `Beaten! ${attacker.name} is through.`,
              defenderIdx: pickDefenderIndex(defTeam, s.chain + 1),
            };
            const drained =
              attackingSide === "home"
                ? { ...next, home: drain(next.home, s0.carrierIdx, action === "sprint" ? 9 : 6) }
                : { ...next, away: drain(next.away, s0.carrierIdx, action === "sprint" ? 9 : 6) };
            return finishIfDone(
              settle(
                push(
                  drained,
                  `${attacker.name} beats ${defender.name}.`,
                  attackingSide === HUMAN ? "good" : "bad",
                ),
              ),
            );
          },
        },
      ]);
      return;
    }

    if (foul) {
      run([
        { delay: 0, patch: advanceBall },
        {
          delay: 950,
          patch: (s) => ({
            ...s,
            banner: inBox
              ? `FOUL IN THE BOX! ${defender.name} brings him down — penalty!`
              : `Foul by ${defender.name} — free kick.`,
          }),
        },
        {
          delay: 700,
          patch: (s) => {
            if (inBox) {
              const attackerIsHuman = attackingSide === HUMAN;
              return settle(
                push(
                  {
                    ...s,
                    penaltyFor: attackingSide,
                    pendingPen: attackerIsHuman
                      ? null
                      : (["left", "right", "chip"] as PenDir[])[Math.floor(Math.random() * 3)]!,
                    phase: attackerIsHuman ? "penalty-aim" : "penalty-dive",
                    progress: 88,
                    lane: 50,
                    banner: attackerIsHuman
                      ? `Penalty to ${atkTeam.short}. Pick your spot.`
                      : `Penalty to ${atkTeam.short}. Guess the spot!`,
                  },
                  `Penalty awarded to ${atkTeam.short}.`,
                  attackerIsHuman ? "good" : "bad",
                ),
              );
            }
            const next: MatchState = {
              ...s,
              progress: clamp(s0.progress + 4, 5, 90),
              chain: 0,
              minute: s.minute + 1,
              phase: "resolve",
              banner: `Free kick to ${atkTeam.short}.`,
            };
            return finishIfDone(settle(push(next, `Foul on ${attacker.name}.`, "info")));
          },
        },
      ]);
      return;
    }

    run([
      { delay: 0, patch: advanceBall },
      {
        delay: 950,
        patch: (s) => ({ ...s, banner: `${defender.name} wins it cleanly!` }),
      },
      {
        delay: 550,
        patch: (s) =>
          turnover(
            push(s, `${defender.name} dispossesses ${attacker.name}.`, "info"),
            `${defender.name} takes it off him.`,
            defIdx,
          ),
      },
    ]);
  }

  // ---------------- open play shot ----------------

  function resolveShot(s0: MatchState, shotDir: ShotDir, diveDir: ShotDir, attackingSide: Side) {
    const atkTeam = attackingSide === "home" ? s0.home : s0.away;
    const defTeam = attackingSide === "home" ? s0.away : s0.home;
    const shooter = atkTeam.players[s0.carrierIdx]!;
    const gk = defTeam.players[0]!;
    const chance = s0.lastChance ?? shotChance(shooter, s0.progress, atkTeam.activeTactic);
    const roll = Math.random() * 100;
    const goalX = attackingSide === "home" ? 97 : 3;
    const targetY = shotDir === "left" ? 34 : shotDir === "right" ? 66 : 50;

    const strike = (s: MatchState): MatchState => ({
      ...s,
      phase: "animating",
      pendingShotDir: null,
      pendingAction: null,
      ballSpeed: 620,
      carrierAnchor: null,
      ball: { x: goalX, y: targetY },
      banner: `${shooter.name} shoots ${shotDir}! (${chance}%)`,
    });

    if (roll > chance) {
      if (Math.random() < 0.5) {
        run([
          { delay: 0, patch: (s) => ({ ...strike(s), ball: { x: goalX, y: shotDir === "left" ? 14 : 86 } }) },
          { delay: 680, patch: (s) => ({ ...s, banner: `Wide! ${shooter.name} drags it off target.` }) },
          {
            delay: 600,
            patch: (s) =>
              turnover(push(s, `${shooter.name} misses the target.`, "info"), "Goal kick."),
          },
        ]);
        return;
      }
      const back = Math.random() < 0.5;
      run([
        { delay: 0, patch: strike },
        {
          delay: 620,
          patch: (s) => ({
            ...s,
            ballSpeed: 520,
            carrierAnchor: { x: s.progress > 50 ? s.ball.x - (attackingSide === "home" ? 10 : -10) : s.ball.x, y: s.lane },
            ball: { x: s.ball.x - (attackingSide === "home" ? 12 : -12), y: clamp(targetY + 12, 8, 92) },
            banner: "Blocked! It deflects off a defender…",
          }),
        },
        {
          delay: 650,
          patch: (s) => {
            if (back) {
              const mate = atkTeam.players.findIndex((p, i) => i !== s0.carrierIdx && p.role === "ATT");
              const next: MatchState = {
                ...s,
                carrierIdx: mate >= 0 ? mate : s0.carrierIdx,
                progress: clamp(s0.progress - 8, 5, 92),
                chain: 0,
                minute: s.minute + 1,
                phase: "resolve",
                banner: "Loose ball — the attack keeps it!",
              };
              return finishIfDone(
                settle(push(next, "Deflection falls back to the attackers.", attackingSide === HUMAN ? "good" : "bad")),
              );
            }
            return turnover(push(s, "Blocked and cleared.", "info"), "Cleared by the defence.");
          },
        },
      ]);
      return;
    }

    const correct = diveDir === shotDir;
    const saveScore = 55 + gkSaveBonus(gk, correct) * 3;
    const saved = correct && Math.random() * 100 < saveScore;
    run([
      { delay: 0, patch: strike },
      {
        delay: 640,
        patch: (s) => ({
          ...s,
          banner: saved
            ? `${gk.name} goes ${diveDir} — SAVED!`
            : `Keeper went ${diveDir}… it's in the corner!`,
        }),
      },
      {
        delay: 650,
        patch: (s) =>
          saved
            ? turnover(
                push(s, `SAVED! ${gk.name} (${gk.gkStyle}) keeps out ${shooter.name}.`, "info"),
                `${gk.name} saves it.`,
              )
            : scoreGoal(s, shooter),
      },
    ]);
  }

  // ---------------- penalty ----------------

  function resolvePenalty(s0: MatchState, shot: PenDir, dive: DiveDir, attackingSide: Side) {
    const atkTeam = attackingSide === "home" ? s0.home : s0.away;
    const defTeam = attackingSide === "home" ? s0.away : s0.home;
    const taker =
      atkTeam.players.map((p, i) => ({ p, i })).filter(({ p }) => p.role === "ATT")[0]?.i ??
      s0.carrierIdx;
    const shooter = atkTeam.players[taker]!;
    const gk = defTeam.players[0]!;
    const goalX = attackingSide === "home" ? 97 : 3;
    const targetY = shot === "left" ? 34 : shot === "right" ? 66 : 50;
    const rightGuess =
      (shot === "left" && dive === "left") ||
      (shot === "right" && dive === "right") ||
      (shot === "chip" && dive === "stay");
    const saved = rightGuess && Math.random() < (shot === "chip" ? 0.9 : 0.82);
    const missed = !saved && Math.random() < 0.08;

    run([
      {
        delay: 0,
        patch: (s) => ({
          ...s,
          phase: "animating",
          carrierIdx: taker,
          progress: 88,
          pendingPen: null,
          ball: { x: goalX, y: missed ? (shot === "left" ? 12 : 88) : targetY },
          ballSpeed: 600,
          carrierAnchor: null,
          banner: `${shooter.name} goes ${shot} — ${gk.name} ${dive === "stay" ? "stands up" : `dives ${dive}`}!`,
        }),
      },
      {
        delay: 640,
        patch: (s) => ({
          ...s,
          banner: saved ? "SAVED!" : missed ? "Off the frame — missed!" : "GOAL!",
        }),
      },
      {
        delay: 650,
        patch: (s) => {
          const clean = { ...s, penaltyFor: null, pendingPen: null };
          if (saved)
            return turnover(
              push(clean, `${gk.name} saves the penalty from ${shooter.name}.`, "info"),
              `${gk.name} saves the penalty!`,
            );
          if (missed)
            return turnover(
              push(clean, `${shooter.name} misses the penalty.`, "info"),
              "Penalty missed.",
            );
          return scoreGoal(clean, shooter);
        },
      },
    ]);
  }

  // ---------------- human inputs ----------------

  const chooseAction = (action: AttackAction) => {
    const s = ref.current;
    if (s.phase !== "choose-action" || s.possession !== HUMAN) return;
    if (action === "pass") {
      const targets = s.home.players
        .map((p, i) => ({ p, i }))
        .filter(({ p, i }) => i !== s.carrierIdx && p.role !== "GK")
        .map(({ i }) => i);
      setState((prev) => ({
        ...prev,
        phase: "choose-pass-target",
        passTargets: targets,
        pendingAction: "pass",
        banner: "Tap a team-mate to pass to. Mind the covered lanes.",
      }));
      return;
    }
    if (action === "shoot") {
      setState((prev) => ({
        ...prev,
        pendingAction: "shoot",
        defenderIdx: pickDefenderIndex(prev.away, prev.chain),
        phase: "shot-aim",
        lastChance: shotChance(prev.home.players[prev.carrierIdx]!, prev.progress, prev.home.activeTactic),
        banner: null,
      }));
      return;
    }
    const response = pickAiResponse(action);
    resolveRun(s, action, response, pickDefenderIndex(s.away, s.chain), "home");
  };

  const kickOff = () => {
    const s = ref.current;
    if (s.phase !== "kickoff") return;
    const team = s.possession === "home" ? s.home : s.away;
    const mids = team.players
      .map((p, i) => ({ p, i }))
      .filter(({ p }) => p.role === "MID" || p.role === "ATT");
    const receiver = mids[Math.floor(Math.random() * mids.length)] ?? { i: 6, p: team.players[6]! };
    const slots = FORMATIONS[team.formation]!.slots[receiver.i]!;
    const to: Pt = {
      x: s.possession === "home" ? slots.x : 100 - slots.x,
      y: slots.y,
    };
    const travel = flightTime({ x: 50, y: 50 }, to, 24, 500, 1000);
    run([
      {
        delay: 0,
        patch: (prev) => ({
          ...prev,
          phase: "animating",
          carrierAnchor: { x: 50, y: 50 },
          ball: to,
          ballSpeed: travel,
          banner: `Kick off — rolled to ${receiver.p.name}.`,
        }),
      },
      {
        delay: travel + 150,
        patch: (prev) => {
          const next: MatchState = {
            ...prev,
            carrierIdx: receiver.i,
            progress: progressFromX(prev.possession, to.x),
            lane: to.y,
            chain: 0,
            phase: prev.possession === HUMAN ? "choose-action" : "resolve",
            banner: prev.possession === HUMAN ? null : "They have it — brace yourself.",
          };
          return settle(push(next, `Kick off. ${receiver.p.name} takes possession.`, "info"));
        },
      },
    ]);
  };

  const cancelShot = () => {
    setState((s) =>
      s.phase === "shot-aim"
        ? { ...s, phase: "choose-action", pendingAction: null, lastChance: null, banner: null }
        : s,
    );
  };

  const choosePassTarget = (idx: number) => {
    const s = ref.current;
    if (s.phase !== "choose-pass-target" || !s.passTargets?.includes(idx)) return;
    resolvePass(s, "home", idx, pickAiResponse("pass"));
  };

  const cancelPass = () => {
    setState((s) =>
      s.phase === "choose-pass-target"
        ? { ...s, phase: "choose-action", passTargets: null, pendingAction: null, banner: null }
        : s,
    );
  };

  const chooseResponse = (response: DefenceResponse) => {
    const s = ref.current;
    if (s.phase !== "choose-response" || !s.pendingAction) return;
    if (s.pendingAction === "pass") {
      resolvePass(s, "away", s.pendingTarget ?? 0, response);
      return;
    }
    resolveRun(s, s.pendingAction as "dribble" | "sprint", response, s.defenderIdx, "away");
  };

  const takeShot = (dir: ShotDir) => {
    const s = ref.current;
    if (s.phase !== "shot-aim") return;
    const keeperDive = (["left", "centre", "right"] as ShotDir[])[Math.floor(Math.random() * 3)]!;
    resolveShot(s, dir, keeperDive, "home");
  };

  const diveShot = (dir: ShotDir) => {
    const s = ref.current;
    if (s.phase !== "shot-dive" || !s.pendingShotDir) return;
    resolveShot(s, s.pendingShotDir, dir, "away");
  };

  const takePenalty = (dir: PenDir) => {
    const s = ref.current;
    if (s.phase !== "penalty-aim") return;
    const dive = (["left", "right", "stay"] as DiveDir[])[Math.floor(Math.random() * 3)]!;
    resolvePenalty(s, dir, dive, "home");
  };

  const divePenalty = (dir: DiveDir) => {
    const s = ref.current;
    if (s.phase !== "penalty-dive" || !s.pendingPen) return;
    resolvePenalty(s, s.pendingPen, dir, "away");
  };

  const nextBeat = () => {
    const s = ref.current;
    if (s.phase === "fulltime") return;
    if (s.possession === HUMAN) {
      setState((prev) => ({ ...prev, phase: "choose-action", banner: null, passTargets: null }));
      return;
    }
    const carrier = s.away.players[s.carrierIdx]!;
    const action = pickAiAction(s.progress, carrier);
    if (action === "shoot") {
      const dir = (["left", "centre", "right"] as ShotDir[])[Math.floor(Math.random() * 3)]!;
      setState((prev) => ({
        ...prev,
        pendingShotDir: dir,
        pendingAction: "shoot",
        lastChance: shotChance(carrier, prev.progress, prev.away.activeTactic),
        phase: "shot-dive",
        banner: `${carrier.name} shoots! Pick your dive.`,
      }));
      return;
    }
    let target: number | null = null;
    if (action === "pass") {
      const pos = positionsFor(s).away;
      const options = s.away.players
        .map((p, i) => ({ p, i }))
        .filter(({ p, i }) => i !== s.carrierIdx && p.role !== "GK")
        .sort((a, b) => pos[a.i]!.x - pos[b.i]!.x)
        .slice(0, 4);
      target = options[Math.floor(Math.random() * options.length)]!.i;
    }
    setState((prev) => ({
      ...prev,
      pendingAction: action,
      pendingTarget: target,
      defenderIdx: pickDefenderIndex(prev.home, prev.chain),
      phase: "choose-response",
      banner: `${carrier.name} is on the ball — read him.`,
    }));
  };

  const playTactic = (tactic: TacticCard) => {
    setState((s) => {
      if (s.home.tacticsLeft <= 0) return s;
      return push(
        { ...s, home: { ...s.home, tacticsLeft: s.home.tacticsLeft - 1, activeTactic: tactic } },
        `Tactic played: ${tactic.replace(/-/g, " ")}.`,
        "info",
      );
    });
  };

  const changeFormation = (formation: FormationName) => {
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
        `Shape switched to ${formation} (${FORMATIONS[formation]!.blurb}).`,
        "info",
      );
    });
  };

  const restart = () => {
    logId.current = 0;
    timers.current.forEach((t) => clearTimeout(t));
    timers.current = [];
    setState(initial(Math.floor(Math.random() * 9999), Math.floor(Math.random() * 9999)));
  };

  const carrier: Player =
    state.possession === "home"
      ? state.home.players[state.carrierIdx]!
      : state.away.players[state.carrierIdx]!;
  const defender: Player =
    state.possession === "home"
      ? state.away.players[state.defenderIdx]!
      : state.home.players[state.defenderIdx]!;

  return {
    state,
    carrier,
    defender,
    chooseAction,
    kickOff,
    cancelShot,
    choosePassTarget,
    cancelPass,
    chooseResponse,
    takeShot,
    diveShot,
    takePenalty,
    divePenalty,
    nextBeat,
    playTactic,
    changeFormation,
    restart,
  };
}
