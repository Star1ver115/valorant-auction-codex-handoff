import { AGENT_PROFICIENCY, AGENT_ROLES } from "./agents";
import { MAP_POOL, PLAYER_BY_ID } from "./player-pool";
import { createRng } from "./rng";
import type {
  AgentComposition,
  AgentId,
  AgentPick,
  AgentRole,
  MapBpResult,
  MapBpStep,
  MapId,
  PlayerCard,
  PlayerId,
  SeededRng,
  TeamId,
  TeamRosters,
} from "./types";
import { DomainError } from "./validation";

const MAP_ROLE_AFFINITY: Record<MapId, Record<AgentRole, number>> = {
  ABYSS: { CONTROLLER: 94, INITIATOR: 92, SENTINEL: 84, DUELIST: 93 },
  CORRODE: { CONTROLLER: 95, INITIATOR: 91, SENTINEL: 90, DUELIST: 89 },
  HAVEN: { CONTROLLER: 96, INITIATOR: 97, SENTINEL: 90, DUELIST: 91 },
  SPLIT: { CONTROLLER: 95, INITIATOR: 89, SENTINEL: 96, DUELIST: 94 },
  LOTUS: { CONTROLLER: 96, INITIATOR: 95, SENTINEL: 90, DUELIST: 92 },
  SUNSET: { CONTROLLER: 94, INITIATOR: 93, SENTINEL: 95, DUELIST: 91 },
  ICEBOX: { CONTROLLER: 97, INITIATOR: 92, SENTINEL: 94, DUELIST: 95 },
};

function roundScore(value: number) {
  return Math.round(value * 100) / 100;
}

function validateRoster(roster: readonly PlayerId[]) {
  if (roster.length !== 5 || new Set(roster).size !== 5) {
    throw new DomainError("INVALID_ROSTER", "Map planning requires five unique players");
  }
  if (roster.some((playerId) => !PLAYER_BY_ID[playerId])) {
    throw new DomainError("UNKNOWN_PLAYER", "Roster contains an unknown player");
  }
}

function roleAlignment(player: PlayerCard, role: AgentRole) {
  if (player.primaryRole === role) return 100;
  if (player.secondaryRoles.includes(role)) return 98;
  if (player.primaryRole === "FLEX") return 96;
  return 88;
}

function playerAgentProficiency(player: PlayerCard, agent: AgentId) {
  const role = AGENT_ROLES[agent];
  return roundScore(
    roleAlignment(player, role) * 0.45 +
      player.attributes.adaptability * 0.2 +
      player.attributes.utility * 0.2 +
      player.attributes.aim * 0.15,
  );
}

function coverageFor(picks: readonly AgentPick[]) {
  return {
    controller: picks.filter((pick) => pick.role === "CONTROLLER").length,
    initiator: picks.filter((pick) => pick.role === "INITIATOR").length,
    sentinel: picks.filter((pick) => pick.role === "SENTINEL").length,
    duelist: picks.filter((pick) => pick.role === "DUELIST").length,
  };
}

function scoreComposition(picks: readonly AgentPick[], map: MapId) {
  const players = picks.map((pick) => PLAYER_BY_ID[pick.playerId]);
  const coverage = coverageFor(picks);
  const P = picks.reduce((sum, pick) => sum + pick.proficiency, 0) / picks.length;
  const M =
    picks.reduce((sum, pick) => sum + MAP_ROLE_AFFINITY[map][pick.role], 0) /
    picks.length;
  const coveredRoles = Object.values(coverage).filter((count) => count > 0).length;
  const R = Math.min(
    100,
    70 + coverage.controller * 8 + coverage.initiator * 8 + coveredRoles * 4,
  );
  const S =
    players.reduce(
      (sum, player) => sum + (player.attributes.igl + player.attributes.adaptability) / 2,
      0,
    ) / players.length;
  const F = Math.min(
    100,
    coveredRoles * 17.5 +
      players.reduce((sum, player) => sum + player.attributes.adaptability, 0) /
        players.length /
        3.34,
  );
  const total = 0.4 * P + 0.25 * M + 0.2 * R + 0.1 * S + 0.05 * F;

  return {
    score: roundScore(total),
    ledger: {
      P: roundScore(P),
      M: roundScore(M),
      R: roundScore(R),
      S: roundScore(S),
      F: roundScore(F),
    },
    coverage,
  };
}

export function selectAgents(
  roster: readonly PlayerId[],
  map: MapId,
  seed: string,
): AgentComposition {
  validateRoster(roster);
  if (!MAP_POOL.includes(map)) throw new DomainError("UNKNOWN_MAP", "Unknown map");

  const rng = createRng(seed);
  type Candidate =
    | {
        picks: AgentPick[];
        score: number;
        ledger: AgentComposition["ledger"];
        coverage: AgentComposition["coverage"];
      }
    | undefined;
  let bestCovered: Candidate;
  let bestFallback: Candidate;
  const picks: AgentPick[] = [];
  const usedAgents = new Set<AgentId>();

  function search(playerIndex: number) {
    if (playerIndex === roster.length) {
      const scored = scoreComposition(picks, map);
      const covered = scored.coverage.controller >= 1 && scored.coverage.initiator >= 1;
      const best = covered ? bestCovered : bestFallback;
      if (
        !best ||
        scored.score > best.score ||
        (scored.score === best.score && rng.next() < 0.5)
      ) {
        const candidate = { picks: picks.map((pick) => ({ ...pick })), ...scored };
        if (covered) bestCovered = candidate;
        else bestFallback = candidate;
      }
      return;
    }

    const playerId = roster[playerIndex];
    const player = PLAYER_BY_ID[playerId];
    for (const agent of AGENT_PROFICIENCY[playerId]) {
      if (usedAgents.has(agent)) continue;
      usedAgents.add(agent);
      picks.push({
        playerId,
        agent,
        role: AGENT_ROLES[agent],
        proficiency: playerAgentProficiency(player, agent),
      });
      search(playerIndex + 1);
      picks.pop();
      usedAgents.delete(agent);
    }
  }

  search(0);
  const best = bestCovered ?? bestFallback;
  if (!best) {
    throw new DomainError(
      "NO_AGENT_COMPOSITION",
      "No unique-agent composition can be formed from career agent pools",
    );
  }

  const roleCount = Object.values(best.coverage).filter((count) => count > 0).length;
  const hasCoreCoverage = best.coverage.controller >= 1 && best.coverage.initiator >= 1;
  return {
    map,
    picks: best.picks,
    coverage: best.coverage,
    score: best.score,
    ledger: best.ledger,
    explanation: hasCoreCoverage
      ? `阵容覆盖控场与先锋，并以 ${roleCount} 类职责取得 ${best.score.toFixed(2)} 的地图适配分。`
      : `生涯特工池无法同时覆盖控场与先锋，系统保留无重复选择，并以 ${roleCount} 类职责取得 ${best.score.toFixed(2)} 的地图适配分。`,
  };
}

function mapStrength(roster: readonly PlayerId[], map: MapId) {
  validateRoster(roster);
  const players = roster.map((playerId) => PLAYER_BY_ID[playerId]);
  const individual =
    players.reduce((sum, player) => sum + player.attributes.overall, 0) / players.length;
  const utility =
    players.reduce((sum, player) => sum + player.attributes.utility, 0) / players.length;
  const leadership =
    players.reduce((sum, player) => sum + player.attributes.igl, 0) / players.length;
  const flexibility =
    players.reduce(
      (sum, player) => sum + player.attributes.adaptability + player.agents.length * 1.5,
      0,
    ) / players.length;
  const roleFit =
    players.reduce((sum, player) => {
      const bestRoleFit = Math.max(
        ...player.agents.map((agent) => MAP_ROLE_AFFINITY[map][AGENT_ROLES[agent]]),
      );
      return sum + bestRoleFit;
    }, 0) / players.length;

  return 0.4 * individual + 0.2 * utility + 0.14 * roleFit + 0.1 * leadership + 0.16 * flexibility;
}

function chooseBest(
  remaining: readonly MapId[],
  score: (map: MapId) => number,
  rng: SeededRng,
) {
  const scored = remaining.map((map) => ({ map, score: roundScore(score(map)) }));
  const bestScore = Math.max(...scored.map((entry) => entry.score));
  const ties = scored.filter((entry) => entry.score === bestScore);
  return ties[rng.int(ties.length)].map;
}

function preferredStartingSide(roster: readonly PlayerId[]): "ATTACK" | "DEFENSE" {
  const players = roster.map((playerId) => PLAYER_BY_ID[playerId]);
  const entry = players.reduce((sum, player) => sum + player.attributes.entry, 0);
  const defense = players.reduce(
    (sum, player) => sum + player.attributes.utility + player.attributes.clutch,
    0,
  ) / 2;
  return entry >= defense ? "ATTACK" : "DEFENSE";
}

export function runMapBp(rosters: TeamRosters, seed: string): MapBpResult {
  validateRoster(rosters.A);
  validateRoster(rosters.B);
  if (new Set([...rosters.A, ...rosters.B]).size !== 10) {
    throw new DomainError("DUPLICATE_PLAYER", "BP requires ten unique players across both teams");
  }

  const rng = createRng(seed);
  const firstTeam: TeamId = rng.int(2) === 0 ? "A" : "B";
  const secondTeam: TeamId = firstTeam === "A" ? "B" : "A";
  const sequence: Array<{ kind: MapBpStep["kind"]; actor: TeamId | null }> = [
    { kind: "BAN", actor: firstTeam },
    { kind: "BAN", actor: secondTeam },
    { kind: "PICK", actor: firstTeam },
    { kind: "PICK", actor: secondTeam },
    { kind: "PICK", actor: firstTeam },
    { kind: "PICK", actor: secondTeam },
    { kind: "DECIDER", actor: null },
  ];
  const remaining = [...MAP_POOL];
  const steps: MapBpStep[] = [];

  for (const entry of sequence) {
    if (entry.kind === "DECIDER") {
      steps.push({
        kind: "DECIDER",
        map: remaining[0],
        actor: null,
        reason: "唯一未被禁用或选择的地图自动成为第五局决胜图。",
      });
      remaining.splice(0, 1);
      continue;
    }

    const actor = entry.actor as TeamId;
    const opponent: TeamId = actor === "A" ? "B" : "A";
    const map = chooseBest(
      remaining,
      entry.kind === "BAN"
        ? (candidate) =>
            (mapStrength(rosters[opponent], candidate) -
              mapStrength(rosters[actor], candidate)) *
              0.65 +
            (100 - mapStrength(rosters[actor], candidate)) * 0.35
        : (candidate) =>
            (mapStrength(rosters[actor], candidate) -
              mapStrength(rosters[opponent], candidate)) *
              0.55 +
            mapStrength(rosters[actor], candidate) * 0.45,
      rng,
    );
    remaining.splice(remaining.indexOf(map), 1);

    if (entry.kind === "BAN") {
      steps.push({
        kind: "BAN",
        map,
        actor,
        reason: `${actor} 队移除自身相对薄弱且对手优势最明显的地图。`,
      });
    } else {
      steps.push({
        kind: "PICK",
        map,
        actor,
        sideSelector: opponent,
        startingSide: preferredStartingSide(rosters[opponent]),
        reason: `${actor} 队选择兼顾自身强度、对手弱点与职业特工深度的地图。`,
      });
    }
  }

  return {
    firstTeam,
    steps,
    playOrder: steps
      .filter((step) => step.kind === "PICK" || step.kind === "DECIDER")
      .map((step) => step.map),
  };
}
