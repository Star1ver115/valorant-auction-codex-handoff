import type { AgentId, PlayerId } from "./types";

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
