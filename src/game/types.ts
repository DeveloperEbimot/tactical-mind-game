export type Attr =
  | "shooting"
  | "passing"
  | "dribbling"
  | "interception"
  | "tackling"
  | "pace"
  | "strength"
  | "positioning"
  | "stamina"
  | "composure"
  | "vision";

export type Ratings = Record<Attr, number>;

export type Role = "GK" | "DEF" | "MID" | "ATT";

export type GkStyle = "Sweeper Keeper" | "Shot Stopper" | "Commanding" | "Distributor";

export interface Player {
  id: string;
  name: string;
  num: number;
  role: Role;
  label: string;
  club: string;
  ratings: Ratings;
  gkStyle?: GkStyle;
  stamina: number; // 0-100 live
}

export type FormationName = "4-4-2" | "4-3-3" | "4-2-3-1" | "5-3-2";

export interface Slot {
  role: Role;
  label: string;
  x: number; // 0 = own goal, 100 = opponent goal
  y: number;
}

export interface Formation {
  name: FormationName;
  blurb: string;
  slots: Slot[];
  attack: number;
  midfield: number;
  defence: number;
}

export type AttackAction = "dribble" | "pass" | "sprint" | "shoot";
export type DefenceResponse = "press" | "tackle" | "cover" | "drop";

export type TacticCard =
  | "high-press"
  | "counter"
  | "tiki-taka"
  | "park-the-bus"
  | "long-ball"
  | "overlap";

export type Side = "home" | "away";

export type Mentality = "attack" | "balanced" | "defend";

export interface TeamState {
  side: Side;
  name: string;
  short: string;
  formation: FormationName;
  mentality: Mentality;
  players: Player[]; // 11, index 0 = GK
  bench: Player[];
  subsLeft: number;
  score: number;
  tacticsLeft: number;
  activeTactic: TacticCard | null;
  formationChangesLeft: number;
}

export type Phase =
  | "kickoff"
  | "choose-action"
  | "choose-pass-target"
  | "choose-response"
  | "shot-aim"
  | "shot-dive"
  | "penalty-aim"
  | "penalty-dive"
  | "animating"
  | "resolve"
  | "fulltime";


export interface LogEntry {
  id: number;
  text: string;
  kind: "info" | "good" | "bad" | "goal";
}
