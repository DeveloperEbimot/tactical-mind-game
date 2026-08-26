import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Pitch } from "@/components/Pitch";
import { FORMATIONS, TACTIC_INFO } from "@/game/data";
import { ACTION_INFO, RESPONSE_INFO } from "@/game/engine";
import { useMatch, type ShotDir, type PenDir, type DiveDir } from "@/game/useMatch";
import type {
  AttackAction,
  DefenceResponse,
  FormationName,
  TacticCard,
} from "@/game/types";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Ballers Shirts — Tactical Football Duel vs AI" },
      {
        name: "description",
        content:
          "A turn-based 11v11 football duel: pick actions, read your opponent, aim your shots and dive the right way. Play the tactical mind game against the AI.",
      },
      { property: "og:title", content: "Ballers Shirts — Tactical Football Duel" },
      {
        property: "og:description",
        content:
          "Attack vs defence mind games, battle chains, live 11v11 pitch, shot-and-dive duels. Play now.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Game,
});

const ACTIONS: AttackAction[] = ["dribble", "pass", "sprint", "shoot"];
const RESPONSES: DefenceResponse[] = ["press", "tackle", "cover", "drop"];
const DIRS: ShotDir[] = ["left", "centre", "right"];
const TACTICS: TacticCard[] = [
  "high-press",
  "counter",
  "tiki-taka",
  "park-the-bus",
  "long-ball",
  "overlap",
];

function Bar({ value, tone = "accent" }: { value: number; tone?: string }) {
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-secondary">
      <div
        className={`h-full rounded-full bg-${tone} transition-all duration-500`}
        style={{ width: `${Math.max(0, Math.min(100, value))}%` }}
      />
    </div>
  );
}

function Game() {
  const {
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
    substitute,
    changeFormation,
    restart,
  } = useMatch();

  const [panel, setPanel] = useState<"tactics" | "shape" | "subs" | "log">("log");
  const [subOff, setSubOff] = useState<number | null>(null);
  const s = state;
  const attackingHome = s.possession === "home";

  return (
    <main className="mx-auto min-h-screen w-full max-w-3xl px-3 pb-10 pt-4">
      <header className="mb-3 flex items-end justify-between">
        <div>
          <h1 className="text-2xl leading-none sm:text-3xl">Ballers Shirts</h1>
          <p className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
            Exhibition · vs AI
          </p>
        </div>
        <button
          onClick={restart}
          className="rounded-md border border-border px-3 py-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground hover:text-foreground"
        >
          New match
        </button>
      </header>

      {/* Scoreboard */}
      <div className="panel mb-3 flex items-center justify-between px-3 py-2">
        <div className="flex items-center gap-2">
          <span className="kit-home flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-bold">
            {s.home.short}
          </span>
          <div>
            <p className="text-sm font-bold leading-none">{s.home.name}</p>
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
              {s.home.formation}
            </p>
          </div>
        </div>
        <div className="text-center">
          <p className="display text-2xl leading-none">
            {s.home.score} <span className="text-muted-foreground">:</span> {s.away.score}
          </p>
          <p className="text-[10px] uppercase tracking-widest text-muted-foreground">
            {Math.min(90, s.minute)}′
          </p>
        </div>
        <div className="flex items-center gap-2 text-right">
          <div>
            <p className="text-sm font-bold leading-none">{s.away.name}</p>
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
              {s.away.formation}
            </p>
          </div>
          <span className="kit-away flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-bold">
            {s.away.short}
          </span>
        </div>
      </div>

      {/* Momentum */}
      <div className="mb-3 flex items-center gap-2">
        <span className="text-[10px] uppercase tracking-widest text-muted-foreground">Mom</span>
        <div className="relative h-1.5 flex-1 overflow-hidden rounded-full bg-secondary">
          <div
            className="absolute top-0 h-full bg-accent transition-all duration-500"
            style={{
              left: s.momentum >= 0 ? "50%" : `${50 + s.momentum / 2}%`,
              width: `${Math.abs(s.momentum) / 2}%`,
            }}
          />
          <div className="absolute left-1/2 top-0 h-full w-px bg-border" />
        </div>
      </div>

      <Pitch state={s} onPickTarget={choosePassTarget} />


      {/* Duel info */}
      <div className="mt-3 grid grid-cols-2 gap-2">
        <div className="panel p-2">
          <p className="text-[10px] uppercase tracking-widest text-muted-foreground">
            On the ball {attackingHome ? "(you)" : "(AI)"}
          </p>
          <p className="text-sm font-bold">
            {carrier.label} {carrier.name}
          </p>
          <p className="text-[11px] text-muted-foreground">
            DRI {carrier.ratings.dribbling} · PAS {carrier.ratings.passing} · SHO{" "}
            {carrier.ratings.shooting} · PAC {carrier.ratings.pace}
          </p>
          <div className="mt-1.5">
            <Bar value={carrier.stamina} />
          </div>
        </div>
        <div className="panel p-2">
          <p className="text-[10px] uppercase tracking-widest text-muted-foreground">
            Defending {attackingHome ? "(AI)" : "(you)"}
          </p>
          <p className="text-sm font-bold">
            {defender.label} {defender.name}
          </p>
          <p className="text-[11px] text-muted-foreground">
            TAC {defender.ratings.tackling} · INT {defender.ratings.interception} · STR{" "}
            {defender.ratings.strength} · POS {defender.ratings.positioning}
          </p>
          <div className="mt-1.5">
            <Bar value={defender.stamina} tone="destructive" />
          </div>
        </div>
      </div>

      {/* Decision panel */}
      <section className="panel mt-3 p-3">
        {s.banner && (
          <p
            className={`mb-2 text-sm font-semibold ${
              s.banner.startsWith("GOAL") ? "text-accent" : "text-foreground"
            }`}
          >
            {s.banner}
          </p>
        )}

        {s.phase === "kickoff" && (
          <button
            onClick={kickOff}
            className="w-full rounded-md bg-primary py-3 text-sm font-bold uppercase tracking-widest text-primary-foreground"
          >
            Kick off
          </button>
        )}

        {s.phase === "choose-action" && (
          <>
            <p className="mb-2 text-[11px] uppercase tracking-widest text-muted-foreground">
              Your move · chain {s.chain} · {Math.round(s.progress)}% up the pitch
            </p>
            <div className="grid grid-cols-2 gap-2">
              {ACTIONS.map((a) => (
                <button
                  key={a}
                  onClick={() => chooseAction(a)}
                  className="rounded-md border border-border bg-secondary px-3 py-2 text-left transition-colors hover:border-accent hover:bg-accent hover:text-accent-foreground"
                >
                  <span className="block text-sm font-bold uppercase">{ACTION_INFO[a]!.name}</span>
                  <span className="block text-[10px] opacity-80">{ACTION_INFO[a]!.vs}</span>
                </button>
              ))}
            </div>
          </>
        )}

        {s.phase === "choose-response" && (
          <>
            <p className="mb-2 text-[11px] uppercase tracking-widest text-muted-foreground">
              They picked an action — you can't see it. Choose your response.
            </p>
            <div className="grid grid-cols-2 gap-2">
              {RESPONSES.map((r) => (
                <button
                  key={r}
                  onClick={() => chooseResponse(r)}
                  className="rounded-md border border-border bg-secondary px-3 py-2 text-left transition-colors hover:border-destructive hover:bg-destructive hover:text-destructive-foreground"
                >
                  <span className="block text-sm font-bold uppercase">{RESPONSE_INFO[r]!.name}</span>
                  <span className="block text-[10px] opacity-80">{RESPONSE_INFO[r]!.desc}</span>
                </button>
              ))}
            </div>
          </>
        )}

        {s.phase === "shot-aim" && (
          <>
            <p className="text-[11px] uppercase tracking-widest text-muted-foreground">
              Shot chance from here
            </p>
            <p className="display text-2xl text-accent">{s.lastChance}%</p>
            <div className="my-2">
              <Bar value={s.lastChance ?? 0} />
            </div>
            <p className="mb-2 text-[11px] text-muted-foreground">
              Pick your side. The keeper only knows a shot is coming.
            </p>
            <div className="grid grid-cols-3 gap-2">
              {DIRS.map((d) => (
                <button
                  key={d}
                  onClick={() => takeShot(d)}
                  className="rounded-md border border-border bg-secondary py-3 text-sm font-bold uppercase hover:border-accent hover:bg-accent hover:text-accent-foreground"
                >
                  {d}
                </button>
              ))}
            </div>
            <button
              onClick={cancelShot}
              className="mt-2 w-full rounded-md border border-border bg-secondary py-2 text-xs font-bold uppercase tracking-widest text-muted-foreground"
            >
              Cancel shot
            </button>
          </>
        )}

        {s.phase === "shot-dive" && (
          <>
            <p className="mb-2 text-[11px] uppercase tracking-widest text-muted-foreground">
              Shot incoming — {s.home.players[0]!.name} ({s.home.players[0]!.gkStyle}). Dive!
            </p>
            <div className="grid grid-cols-3 gap-2">
              {DIRS.map((d) => (
                <button
                  key={d}
                  onClick={() => diveShot(d)}
                  className="rounded-md border border-border bg-secondary py-3 text-sm font-bold uppercase hover:border-accent hover:bg-accent hover:text-accent-foreground"
                >
                  {d}
                </button>
              ))}
            </div>
          </>
        )}

        {s.phase === "choose-pass-target" && (
          <>
            <p className="mb-2 text-[11px] uppercase tracking-widest text-muted-foreground">
              Tap a flashing team-mate on the pitch — a defender in the lane will cut it out.
            </p>
            <button
              onClick={cancelPass}
              className="w-full rounded-md border border-border bg-secondary py-2 text-xs font-bold uppercase tracking-widest text-muted-foreground"
            >
              Cancel pass
            </button>
          </>
        )}

        {s.phase === "animating" && (
          <p className="py-2 text-[11px] uppercase tracking-widest text-muted-foreground">
            Ball in play…
          </p>
        )}

        {s.phase === "penalty-aim" && (
          <>
            <p className="mb-2 text-[11px] uppercase tracking-widest text-muted-foreground">
              Penalty. Pick your finish — chip beats a diver, not a keeper who stands up.
            </p>
            <div className="grid grid-cols-3 gap-2">
              {(["left", "chip", "right"] as PenDir[]).map((d) => (
                <button
                  key={d}
                  onClick={() => takePenalty(d)}
                  className="rounded-md border border-border bg-secondary py-3 text-sm font-bold uppercase hover:border-accent hover:bg-accent hover:text-accent-foreground"
                >
                  {d}
                </button>
              ))}
            </div>
          </>
        )}

        {s.phase === "penalty-dive" && (
          <>
            <p className="mb-2 text-[11px] uppercase tracking-widest text-muted-foreground">
              Penalty against you — {s.home.players[0]!.name}. Dive or stand up.
            </p>
            <div className="grid grid-cols-3 gap-2">
              {(["left", "stay", "right"] as DiveDir[]).map((d) => (
                <button
                  key={d}
                  onClick={() => divePenalty(d)}
                  className="rounded-md border border-border bg-secondary py-3 text-sm font-bold uppercase hover:border-accent hover:bg-accent hover:text-accent-foreground"
                >
                  {d}
                </button>
              ))}
            </div>
          </>
        )}


        {s.phase === "resolve" && (
          <button
            onClick={nextBeat}
            className="w-full rounded-md bg-primary py-3 text-sm font-bold uppercase tracking-widest text-primary-foreground"
          >
            {s.possession === "home" ? "Continue attack" : "Face their attack"}
          </button>
        )}

        {s.phase === "fulltime" && (
          <div className="text-center">
            <p className="display text-xl">
              Full time · {s.home.score}–{s.away.score}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              {s.home.score > s.away.score
                ? "You win it."
                : s.home.score === s.away.score
                  ? "Honours shared."
                  : "Rival United take it."}
            </p>
            <button
              onClick={restart}
              className="mt-3 w-full rounded-md bg-primary py-3 text-sm font-bold uppercase tracking-widest text-primary-foreground"
            >
              Rematch
            </button>
          </div>
        )}
      </section>

      {/* Tabs */}
      <div className="mt-4 flex gap-2">
        {(["log", "tactics", "shape", "subs"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setPanel(t)}
            className={`rounded-md px-3 py-1.5 text-[11px] font-bold uppercase tracking-widest ${
              panel === t
                ? "bg-primary text-primary-foreground"
                : "bg-secondary text-muted-foreground"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      <section className="panel mt-2 p-3">
        {panel === "log" && (
          <ul className="max-h-56 space-y-1.5 overflow-y-auto text-[12px]">
            {s.log.map((l) => (
              <li
                key={l.id}
                className={
                  l.kind === "goal"
                    ? "font-bold text-accent"
                    : l.kind === "good"
                      ? "text-foreground"
                      : l.kind === "bad"
                        ? "text-destructive"
                        : "text-muted-foreground"
                }
              >
                {l.text}
              </li>
            ))}
          </ul>
        )}

        {panel === "tactics" && (
          <>
            <p className="mb-2 text-[11px] uppercase tracking-widest text-muted-foreground">
              Unlimited tactic cards · tap to toggle
              {s.home.activeTactic ? ` · active: ${TACTIC_INFO[s.home.activeTactic]!.name}` : ""}
            </p>
            <div className="grid grid-cols-2 gap-2">
              {TACTICS.map((t) => (
                <button
                  key={t}
                  onClick={() => playTactic(t)}
                  className={`rounded-md border px-3 py-2 text-left disabled:opacity-40 ${
                    s.home.activeTactic === t
                      ? "border-accent bg-accent/10"
                      : "border-border bg-secondary hover:border-accent"
                  }`}
                >
                  <span className="block text-xs font-bold uppercase">{TACTIC_INFO[t]!.name}</span>
                  <span className="block text-[10px] text-muted-foreground">
                    {TACTIC_INFO[t]!.desc}
                  </span>
                </button>
              ))}
            </div>
          </>
        )}

        {panel === "shape" && (
          <>
            <p className="mb-2 text-[11px] uppercase tracking-widest text-muted-foreground">
              Switch shape as often as you like
            </p>
            <div className="grid grid-cols-2 gap-2">
              {(Object.keys(FORMATIONS) as FormationName[]).map((f) => (
                <button
                  key={f}
                  onClick={() => changeFormation(f)}
                  className={`rounded-md border px-3 py-2 text-left disabled:opacity-40 ${
                    s.home.formation === f
                      ? "border-accent bg-accent/10"
                      : "border-border bg-secondary hover:border-accent"
                  }`}
                >
                  <span className="block text-sm font-bold">{f}</span>
                  <span className="block text-[10px] text-muted-foreground">
                    {FORMATIONS[f]!.blurb}
                  </span>
                </button>
              ))}
            </div>
          </>
        )}
        {panel === "subs" && (
          <>
            <p className="mb-2 text-[11px] uppercase tracking-widest text-muted-foreground">
              Substitutions left: {s.home.subsLeft}
            </p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className="mb-1 text-[10px] uppercase tracking-widest text-muted-foreground">
                  On the pitch
                </p>
                <ul className="max-h-56 space-y-1 overflow-y-auto">
                  {s.home.players.map((p, i) => (
                    <li key={p.id}>
                      <button
                        onClick={() => setSubOff(subOff === i ? null : i)}
                        className={`w-full rounded-md border px-2 py-1.5 text-left text-[11px] ${
                          subOff === i
                            ? "border-accent bg-accent/10"
                            : "border-border bg-secondary"
                        }`}
                      >
                        <span className="font-bold">
                          {p.label} {p.name}
                        </span>
                        <span className="block text-[10px] text-muted-foreground">
                          STA {Math.round(p.stamina)}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <p className="mb-1 text-[10px] uppercase tracking-widest text-muted-foreground">
                  Bench {subOff === null ? "(pick a player first)" : "(tap to bring on)"}
                </p>
                <ul className="max-h-56 space-y-1 overflow-y-auto">
                  {s.home.bench.length === 0 && (
                    <li className="text-[11px] text-muted-foreground">Bench is empty.</li>
                  )}
                  {s.home.bench.map((p, i) => (
                    <li key={p.id}>
                      <button
                        disabled={subOff === null || s.home.subsLeft <= 0}
                        onClick={() => {
                          if (subOff === null) return;
                          substitute(subOff, i);
                          setSubOff(null);
                        }}
                        className="w-full rounded-md border border-border bg-secondary px-2 py-1.5 text-left text-[11px] disabled:opacity-40"
                      >
                        <span className="font-bold">
                          {p.label} {p.name}
                        </span>
                        <span className="block text-[10px] text-muted-foreground">
                          PAC {p.ratings.pace} · STA {Math.round(p.stamina)}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </>
        )}
      </section>
    </main>
  );
}
