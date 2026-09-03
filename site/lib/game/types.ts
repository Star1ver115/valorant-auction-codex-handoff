export type Tier = "T0" | "T0.5" | "T1" | "T1.5";

export type Role =
  | "DUELIST"
  | "INITIATOR"
  | "CONTROLLER"
  | "SENTINEL"
  | "FLEX";

export type PlayerId =
  | "aspas"
  | "chronicle"
  | "zmjjkk"
  | "leo"
  | "less"
  | "mako"
  | "forsaken"
  | "nobody"
  | "chichoo"
  | "boaster";

export type AgentId =
  | "ASTRA"
  | "BREACH"
  | "BRIMSTONE"
  | "CHAMBER"
  | "CYPHER"
  | "FADE"
  | "GEKKO"
  | "HARBOR"
  | "JETT"
  | "KILLJOY"
  | "NEON"
  | "OMEN"
  | "RAZE"
  | "SKYE"
  | "SOVA"
  | "VIPER"
  | "VYSE"
  | "YORU";

export type MapId =
  | "ABYSS"
  | "CORRODE"
  | "HAVEN"
  | "SPLIT"
  | "LOTUS"
  | "SUNSET"
  | "ICEBOX";

export type PeakSample = {
  event: string;
  rounds: number;
  sampleScope: "FULL_EVENT";
  evidence: string;
};

export type Attributes = {
  overall: number;
  aim: number;
  entry: number;
  utility: number;
  clutch: number;
  igl: number;
  adaptability: number;
};

export type PlayerCard = {
  id: PlayerId;
  name: string;
  region: "CN" | "EMEA" | "AMERICAS" | "PACIFIC";
  primaryRole: Role;
  secondaryRoles: Role[];
  tier: Tier;
  referencePrice: number;
  peak: PeakSample;
  attributes: Attributes;
  agents: AgentId[];
};
