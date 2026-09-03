import assert from "node:assert/strict";
import test, { after } from "node:test";
import { createTestVite } from "./fixtures.mjs";

const vite = await createTestVite();

after(() => vite.close());

test("contains ten unique complete-event peak cards", async () => {
  const { MAP_POOL, PLAYER_POOL } = await vite.ssrLoadModule(
    "/lib/game/player-pool.ts",
  );
  const { AGENT_PROFICIENCY } = await vite.ssrLoadModule("/lib/game/agents.ts");

  assert.equal(PLAYER_POOL.length, 10);
  assert.equal(new Set(PLAYER_POOL.map((player) => player.id)).size, 10);
  assert.equal(
    PLAYER_POOL.every((player) => player.peak.sampleScope === "FULL_EVENT"),
    true,
  );
  assert.equal(PLAYER_POOL.find((player) => player.id === "zmjjkk").tier, "T0.5");
  assert.equal(PLAYER_POOL.find((player) => player.id === "zmjjkk").referencePrice, 6);
  assert.equal(PLAYER_POOL.find((player) => player.id === "chichoo").referencePrice, 5);

  assert.deepEqual(
    PLAYER_POOL.map(({ id, name, region, primaryRole, secondaryRoles, tier, referencePrice, peak, attributes }) => ({
      id,
      name,
      region,
      primaryRole,
      secondaryRoles,
      tier,
      referencePrice,
      peak,
      attributes,
    })),
    [
      { id: "aspas", name: "aspas", region: "AMERICAS", primaryRole: "DUELIST", secondaryRoles: [], tier: "T0", referencePrice: 7, peak: { event: "VCT Americas 2024 Stage 2", rounds: 479, sampleScope: "FULL_EVENT", evidence: "Rating 1.32、ACS 269、K/D 1.52" }, attributes: { overall: 99, aim: 100, entry: 100, utility: 89, clutch: 97, igl: 74, adaptability: 88 } },
      { id: "chronicle", name: "Chronicle", region: "EMEA", primaryRole: "FLEX", secondaryRoles: [], tier: "T0", referencePrice: 7, peak: { event: "Masters Berlin 2021", rounds: 306, sampleScope: "FULL_EVENT", evidence: "Rating 1.26、ACS 222.9、K/D 1.35" }, attributes: { overall: 99, aim: 97, entry: 88, utility: 99, clutch: 97, igl: 90, adaptability: 100 } },
      { id: "zmjjkk", name: "ZmjjKK（康康）", region: "CN", primaryRole: "DUELIST", secondaryRoles: [], tier: "T0.5", referencePrice: 6, peak: { event: "Masters Tokyo 2023 完整赛事", rounds: 341, sampleScope: "FULL_EVENT", evidence: "Rating 1.15、ACS 272、K/D 1.30；Champions 2024 完整赛事为 449 回合、Rating 1.10、ACS 251；首尔冠军与决赛纪录仅作大赛上限佐证" }, attributes: { overall: 98, aim: 100, entry: 100, utility: 87, clutch: 94, igl: 72, adaptability: 86 } },
      { id: "leo", name: "Leo", region: "EMEA", primaryRole: "INITIATOR", secondaryRoles: [], tier: "T0", referencePrice: 6, peak: { event: "Masters Tokyo 2023", rounds: 210, sampleScope: "FULL_EVENT", evidence: "Rating 1.31、K/D 1.47、KAST 80%" }, attributes: { overall: 99, aim: 96, entry: 79, utility: 100, clutch: 99, igl: 88, adaptability: 96 } },
      { id: "less", name: "Less", region: "AMERICAS", primaryRole: "SENTINEL", secondaryRoles: ["CONTROLLER"], tier: "T0.5", referencePrice: 5, peak: { event: "VCT Americas 2023 联赛", rounds: 643, sampleScope: "FULL_EVENT", evidence: "Rating 1.18、ACS 229、K/D 1.32" }, attributes: { overall: 97, aim: 98, entry: 80, utility: 96, clutch: 98, igl: 81, adaptability: 92 } },
      { id: "mako", name: "MaKo", region: "PACIFIC", primaryRole: "CONTROLLER", secondaryRoles: [], tier: "T0.5", referencePrice: 5, peak: { event: "LOCK//IN 2023", rounds: 276, sampleScope: "FULL_EVENT", evidence: "Rating 1.28、ACS 240、K/D 1.25、KAST 79%" }, attributes: { overall: 97, aim: 96, entry: 74, utility: 100, clutch: 99, igl: 86, adaptability: 93 } },
      { id: "forsaken", name: "f0rsakeN", region: "PACIFIC", primaryRole: "FLEX", secondaryRoles: [], tier: "T0.5", referencePrice: 5, peak: { event: "Masters Toronto 2025", rounds: 387, sampleScope: "FULL_EVENT", evidence: "Rating 1.12、KAST 74%、APR 0.40" }, attributes: { overall: 97, aim: 96, entry: 94, utility: 97, clutch: 94, igl: 96, adaptability: 100 } },
      { id: "nobody", name: "nobody", region: "CN", primaryRole: "INITIATOR", secondaryRoles: [], tier: "T1", referencePrice: 4, peak: { event: "Masters Tokyo 2023", rounds: 341, sampleScope: "FULL_EVENT", evidence: "ACS 190、KAST 75%；Champions 2024 完成 10 次残局作为辅助证据" }, attributes: { overall: 91, aim: 90, entry: 82, utility: 96, clutch: 90, igl: 89, adaptability: 94 } },
      { id: "chichoo", name: "CHICHOO", region: "CN", primaryRole: "SENTINEL", secondaryRoles: ["CONTROLLER"], tier: "T0.5", referencePrice: 5, peak: { event: "Masters Bangkok 2025", rounds: 313, sampleScope: "FULL_EVENT", evidence: "Rating 1.23、ACS 236、K/D 1.27、11 次残局" }, attributes: { overall: 96, aim: 97, entry: 78, utility: 96, clutch: 99, igl: 82, adaptability: 92 } },
      { id: "boaster", name: "Boaster", region: "EMEA", primaryRole: "CONTROLLER", secondaryRoles: [], tier: "T1.5", referencePrice: 3, peak: { event: "LOCK//IN 2023", rounds: 307, sampleScope: "FULL_EVENT", evidence: "Rating 1.00、KAST 78%；VCT 2023 EMEA 年度 IGL 作为辅助证据" }, attributes: { overall: 89, aim: 83, entry: 73, utility: 95, clutch: 87, igl: 100, adaptability: 95 } },
    ],
  );

  assert.deepEqual(MAP_POOL, ["ABYSS", "CORRODE", "HAVEN", "SPLIT", "LOTUS", "SUNSET", "ICEBOX"]);
  assert.deepEqual(AGENT_PROFICIENCY, {
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
  });
});
