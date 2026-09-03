import type { AgentId, AgentRole, PlayerId } from "./types";

export const AGENT_PROFICIENCY = {
  aspas: ["JETT", "RAZE", "NEON"],
  chronicle: ["VIPER", "BREACH", "SOVA", "KILLJOY", "OMEN", "RAZE"],
  zmjjkk: ["JETT", "RAZE", "NEON"],
  leo: ["SOVA", "FADE", "SKYE", "BREACH"],
  less: ["KILLJOY", "CYPHER", "VIPER", "CHAMBER"],
  mako: ["OMEN", "VIPER", "ASTRA", "BRIMSTONE", "HARBOR"],
  forsaken: ["YORU", "NEON", "RAZE", "HARBOR", "BREACH", "SKYE", "CYPHER"],
  nobody: ["SOVA", "FADE", "GEKKO", "BREACH"],
  chichoo: ["CYPHER", "KILLJOY", "VYSE", "VIPER", "CHAMBER"],
  boaster: ["OMEN", "ASTRA", "VIPER", "BRIMSTONE", "HARBOR"],
} as const satisfies Readonly<Record<PlayerId, readonly AgentId[]>>;

export const AGENT_ROLES = {
  ASTRA: "CONTROLLER",
  BREACH: "INITIATOR",
  BRIMSTONE: "CONTROLLER",
  CHAMBER: "SENTINEL",
  CYPHER: "SENTINEL",
  FADE: "INITIATOR",
  GEKKO: "INITIATOR",
  HARBOR: "CONTROLLER",
  JETT: "DUELIST",
  KILLJOY: "SENTINEL",
  NEON: "DUELIST",
  OMEN: "CONTROLLER",
  RAZE: "DUELIST",
  SKYE: "INITIATOR",
  SOVA: "INITIATOR",
  VIPER: "CONTROLLER",
  VYSE: "SENTINEL",
  YORU: "DUELIST",
} as const satisfies Readonly<Record<AgentId, AgentRole>>;
