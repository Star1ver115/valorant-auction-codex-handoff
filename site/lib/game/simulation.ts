import { PLAYER_BY_ID } from "./player-pool";
import { createRng } from "./rng";
import type {
  AgentComposition,
  MapId,
  PlayedMapResult,
  PlayerId,
  PlayerLine,
  PurchaseRecord,
  RoundCategory,
  RoundEvent,
  SeededRng,
  SeriesInput,
  SeriesResult,
  TeamId,
} from "./types";
import { DomainError } from "./validation";

const STRENGTH_WEIGHTS = {
  individual: 40,
  composition: 20,
  map: 14,
  leadership: 10,
  synergy: 4,
  form: 12,
} as const;

type TeamFactors = {
  individual: number;
  composition: number;
  map: number;
  leadership: number;
  synergy: number;
  form: number;
  total: number;
};

function round(value: number) {
  return Math.round(value * 100) / 100;
}

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(maximum, Math.max(minimum, value));
}

function average(values: readonly number[]) {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function factorsFor(
  roster: readonly PlayerId[],
  composition: AgentComposition,
  rng: SeededRng,
): TeamFactors {
  const players = roster.map((playerId) => PLAYER_BY_ID[playerId]);
  const individual = average(
    players.map(
      (player) =>
        player.attributes.aim * 0.3 +
        player.attributes.entry * 0.2 +
        player.attributes.utility * 0.2 +
        player.attributes.clutch * 0.15 +
        player.attributes.adaptability * 0.15,
    ),
  );
  const map = composition.ledger.M * 0.7 + composition.ledger.F * 0.3;
  const leadership = average(players.map((player) => player.attributes.igl));
  const synergy =
    average(players.map((player) => player.attributes.adaptability)) * 0.65 +
    composition.ledger.R * 0.35;
  const teamForm = 50 + (rng.next() + rng.next() - 1) * 34;
  const playerForm = average(
    players.map(() => 50 + (rng.next() + rng.next() - 1) * 28),
  );
  const form = clamp(teamForm * 0.62 + playerForm * 0.38, 12, 88);
  const total =
    individual * 0.4 +
    composition.score * 0.2 +
    map * 0.14 +
    leadership * 0.1 +
    synergy * 0.04 +
    form * 0.12;

  return {
    individual: round(individual),
    composition: composition.score,
    map: round(map),
    leadership: round(leadership),
    synergy: round(synergy),
    form: round(form),
    total: round(total),
  };
}

type EconomyState = { bank: number; lossStreak: number };

function equipmentSpend(economy: EconomyState) {
  if (economy.bank >= 4_100) return 4_100;
  if (economy.bank >= 2_400) return 2_400;
  if (economy.bank >= 1_300) return 1_300;
  return 0;
}

function settleEconomy(
  economy: Record<TeamId, EconomyState>,
  winner: TeamId,
  spend: Record<TeamId, number>,
) {
  const loser: TeamId = winner === "A" ? "B" : "A";
  economy.A.bank -= spend.A;
  economy.B.bank -= spend.B;
  economy[winner].bank += 3_000;
  economy[winner].lossStreak = 0;
  economy[loser].lossStreak = Math.min(4, economy[loser].lossStreak + 1);
  economy[loser].bank += 1_900 + economy[loser].lossStreak * 350;
}

function roundCategory(
  number: number,
  spend: Record<TeamId, number>,
  rng: SeededRng,
): RoundCategory {
  if (number === 1 || number === 13) return "PISTOL";
  if (number === 2 || number === 14) return "ANTI_ECO";
  if (rng.next() < 0.09) return "CLUTCH";
  if (spend.A >= 4_100 && spend.B >= 4_100) return "RIFLE";
  if (Math.min(spend.A, spend.B) === 0 && Math.max(spend.A, spend.B) >= 2_400) {
    return "ECO";
  }
  return rng.next() < 0.48 ? "SAVE" : "ECO";
}

function descriptionFor(category: RoundCategory, winner: TeamId, number: number) {
  const labels: Record<RoundCategory, string> = {
    PISTOL: "手枪局建立首轮经济主动",
    ANTI_ECO: "奖励局稳健处理对手低配武器",
    RIFLE: "长枪局通过正面交火拿下关键空间",
    ECO: "经济局以低投入制造出人意料的突破",
    SAVE: "存枪取舍影响下一轮装备完整度",
    CLUTCH: "关键残局在最后交火中完成逆转",
  };
  return `第 ${number} 回合，${winner} 队${labels[category]}。`;
}

function attackPreference(roster: readonly PlayerId[]) {
  const players = roster.map((playerId) => PLAYER_BY_ID[playerId]);
  return average(players.map((player) => player.attributes.entry - player.attributes.utility));
}

function probabilityForA(
  factors: Record<TeamId, TeamFactors>,
  attackTeam: TeamId,
  rosters: SeriesInput["rosters"],
  spend: Record<TeamId, number>,
) {
  const logistic = 1 / (1 + Math.exp(-(factors.A.total - factors.B.total) / 5.5));
  const sideAdjustment =
    (attackPreference(rosters[attackTeam]) -
      attackPreference(rosters[attackTeam === "A" ? "B" : "A"])) /
    520;
  const economyAdjustment = clamp((spend.A - spend.B) / 38_000, -0.08, 0.08);
  const orientedSideAdjustment = attackTeam === "A" ? sideAdjustment : -sideAdjustment;
  return clamp(logistic + orientedSideAdjustment + economyAdjustment, 0.18, 0.82);
}

function mapStartingAttack(input: SeriesInput, map: MapId, rng: SeededRng): TeamId {
  const step = input.bp.steps.find((entry) => entry.map === map);
  if (step?.sideSelector && step.startingSide) {
    return step.startingSide === "ATTACK"
      ? step.sideSelector
      : step.sideSelector === "A"
        ? "B"
        : "A";
  }
  return rng.int(2) === 0 ? "A" : "B";
}

function buildPlayerLines(
  input: SeriesInput,
  score: Record<TeamId, number>,
  winner: TeamId,
  rounds: readonly RoundEvent[],
  rng: SeededRng,
): PlayerLine[] {
  const totalRounds = score.A + score.B;
  const clutchWinners = rounds.filter((event) => event.category === "CLUTCH");
  const lines: PlayerLine[] = [];

  for (const team of ["A", "B"] as const) {
    const opponent: TeamId = team === "A" ? "B" : "A";
    for (const playerId of input.rosters[team]) {
      const player = PLAYER_BY_ID[playerId];
      const performance = (rng.next() + rng.next() - 1) * 14;
      const kills = Math.max(
        0,
        Math.round(
          totalRounds * 0.62 +
            (player.attributes.aim - 90) * 0.28 +
            performance +
            (winner === team ? 2 : -1),
        ),
      );
      const deaths = Math.max(
        1,
        Math.round(
          totalRounds * 0.61 +
            (100 - player.attributes.clutch) * 0.12 +
            (winner === opponent ? 2 : -1) +
            (rng.next() - 0.5) * 5,
        ),
      );
      const assists = Math.max(
        0,
        Math.round(totalRounds * 0.22 + (player.attributes.utility - 85) * 0.2 + rng.next() * 4),
      );
      const firstKills = Math.max(
        0,
        Math.round(totalRounds * 0.06 + (player.attributes.entry - 80) * 0.08 + rng.next() * 2),
      );
      const clutches = clutchWinners.filter((event) => event.winner === team).length
        ? rng.int(Math.min(3, clutchWinners.filter((event) => event.winner === team).length) + 1)
        : 0;
      const acs = Math.max(
        80,
        Math.round(
          105 +
            kills * 5.4 -
            deaths * 1.7 +
            assists * 1.25 +
            firstKills * 3.2 +
            player.attributes.aim * 0.62,
        ),
      );
      lines.push({ playerId, team, acs, kills, deaths, assists, firstKills, clutches });
    }
  }

  return lines;
}

function highlightsFor(rounds: readonly RoundEvent[]) {
  const selected: RoundEvent[] = [];
  const add = (event: RoundEvent | undefined) => {
    if (event && !selected.some((candidate) => candidate.number === event.number)) selected.push(event);
  };
  add(rounds[0]);
  add(rounds.find((event) => event.category === "CLUTCH"));
  add(rounds[Math.floor(rounds.length / 2)]);
  add(rounds.at(-1));
  return selected.slice(0, 5).map((event) => event.description);
}

function simulateMap(
  input: SeriesInput,
  map: MapId,
  rng: SeededRng,
): { result: PlayedMapResult; factors: Record<TeamId, TeamFactors> } {
  const compositions = input.compositions[map];
  if (!compositions) {
    throw new DomainError("MISSING_COMPOSITION", `Missing agent composition for ${map}`);
  }

  const factors = {
    A: factorsFor(input.rosters.A, compositions.A, rng),
    B: factorsFor(input.rosters.B, compositions.B, rng),
  };
  const initialAttack = mapStartingAttack(input, map, rng);
  const score: Record<TeamId, number> = { A: 0, B: 0 };
  const rounds: RoundEvent[] = [];
  const economy: Record<TeamId, EconomyState> = {
    A: { bank: 800, lossStreak: 0 },
    B: { bank: 800, lossStreak: 0 },
  };

  while (Math.max(score.A, score.B) < 13 || Math.abs(score.A - score.B) < 2) {
    const number = rounds.length + 1;
    const attackTeam: TeamId =
      number <= 12
        ? initialAttack
        : number <= 24
          ? initialAttack === "A"
            ? "B"
            : "A"
          : number % 2 === 1
            ? initialAttack
            : initialAttack === "A"
              ? "B"
              : "A";
    const spend = {
      A: number === 1 || number === 13 ? 800 : equipmentSpend(economy.A),
      B: number === 1 || number === 13 ? 800 : equipmentSpend(economy.B),
    };
    const probabilityA = probabilityForA(factors, attackTeam, input.rosters, spend);
    const winner: TeamId = rng.next() < probabilityA ? "A" : "B";
    score[winner] += 1;
    const category = roundCategory(number, spend, rng);
    rounds.push({
      number,
      category,
      winner,
      scoreAfter: { ...score },
      attackTeam,
      description: descriptionFor(category, winner, number),
    });
    settleEconomy(economy, winner, spend);
  }

  const winner: TeamId = score.A > score.B ? "A" : "B";
  const playerLines = buildPlayerLines(input, score, winner, rounds, rng);
  const mvp = [...playerLines].sort(
    (left, right) => right.acs - left.acs || right.kills - left.kills,
  )[0];
  const margin = Math.abs(score.A - score.B);

  return {
    factors,
    result: {
      status: "PLAYED",
      map,
      score,
      winner,
      rounds,
      playerLines,
      mvp,
      highlights: highlightsFor(rounds),
      winningFactors: [
        `${winner} 队以更稳定的长枪局转化建立比分优势。`,
        `${winner} 队的阵容适配与关键回合执行形成正向叠加。`,
        margin >= 5
          ? `最终 ${margin} 回合的分差体现了持续压制。`
          : "接近局中，残局与经济管理决定了最后结果。",
      ],
      compositions,
      strength: { A: factors.A.total, B: factors.B.total },
    },
  };
}

function evaluatePurchases(purchases: readonly PurchaseRecord[]) {
  if (purchases.length === 0) {
    throw new DomainError("MISSING_PURCHASES", "Series report requires auction purchases");
  }
  const bestPurchase = purchases
    .map((purchase) => ({
      ...purchase,
      value: round(PLAYER_BY_ID[purchase.playerId].attributes.overall / Math.max(0.5, purchase.price)),
    }))
    .sort((left, right) => right.value - left.value)[0];
  const overpay = purchases
    .map((purchase) => ({
      ...purchase,
      premium: purchase.price - PLAYER_BY_ID[purchase.playerId].referencePrice,
    }))
    .sort((left, right) => right.premium - left.premium)[0];
  return { bestPurchase, overpay };
}

export function simulateSeries(input: SeriesInput): SeriesResult {
  const rng = createRng(input.seed);
  const score: Record<TeamId, number> = { A: 0, B: 0 };
  const maps: SeriesResult["maps"] = [];
  const ledgerMaps: SeriesResult["strengthLedger"]["maps"] = [];

  for (const map of input.bp.playOrder) {
    if (score.A === 3 || score.B === 3) {
      maps.push({ status: "NOT_NEEDED", map });
      continue;
    }
    const simulated = simulateMap(input, map, rng);
    maps.push(simulated.result);
    ledgerMaps.push({ map, teams: simulated.factors });
    score[simulated.result.winner] += 1;
  }

  const winner: TeamId = score.A === 3 ? "A" : "B";
  const playedLines = maps
    .filter((map): map is PlayedMapResult => map.status === "PLAYED")
    .flatMap((map) => map.playerLines);
  const totals = new Map<PlayerId, PlayerLine>();
  for (const line of playedLines) {
    const current = totals.get(line.playerId) ?? {
      playerId: line.playerId,
      team: line.team,
      acs: 0,
      kills: 0,
      deaths: 0,
      assists: 0,
      firstKills: 0,
      clutches: 0,
    };
    current.acs += line.acs;
    current.kills += line.kills;
    current.deaths += line.deaths;
    current.assists += line.assists;
    current.firstKills += line.firstKills;
    current.clutches += line.clutches;
    totals.set(line.playerId, current);
  }
  const playedMapCount = ledgerMaps.length;
  const seriesLines = [...totals.values()].map((line) => ({
    ...line,
    acs: Math.round(line.acs / playedMapCount),
  }));
  const seriesMvp = seriesLines.sort(
    (left, right) => right.acs - left.acs || right.kills - left.kills,
  )[0];
  const { bestPurchase, overpay } = evaluatePurchases(input.purchases);

  return {
    winner,
    score,
    maps,
    seriesMvp,
    bestPurchase,
    overpay,
    winningFactors: [
      `${winner} 队率先拿到三张地图，系列赛在决定性胜局后立即结束。`,
      `${winner} 队在地图适配、临场波动和关键经济局之间取得更好平衡。`,
      score[winner] === 3 && score[winner === "A" ? "B" : "A"] <= 1
        ? "大比分优势来自多张地图上的持续执行力。"
        : "胶着系列赛由最后阶段的关键回合转化决定。",
    ],
    strengthLedger: { weights: STRENGTH_WEIGHTS, maps: ledgerMaps },
  };
}
