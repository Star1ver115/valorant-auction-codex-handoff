import { fileURLToPath } from "node:url";
import { createServer } from "vite";

const projectRoot = fileURLToPath(new URL("..", import.meta.url));

export function createTestVite() {
  return createServer({
    appType: "custom",
    configFile: false,
    root: projectRoot,
    resolve: { alias: { "@": projectRoot } },
    server: { middlewareMode: true, ws: false },
  });
}

export const PLAYER_IDS = [
  "aspas",
  "chronicle",
  "zmjjkk",
  "leo",
  "less",
  "mako",
  "forsaken",
  "nobody",
  "chichoo",
  "boaster",
];

export function auctionFixture({ opener = "A" } = {}) {
  return {
    phase: "AUCTION",
    order: [...PLAYER_IDS],
    lotIndex: 0,
    teams: {
      A: { budget: 20, roster: [] },
      B: { budget: 20, roster: [] },
    },
    bidding: {
      playerId: PLAYER_IDS[0],
      opener,
      actor: opener,
      currentBid: null,
      highBidder: null,
      passed: [],
    },
    zeroBudget: null,
  };
}

export function zeroBudgetFixture() {
  return {
    phase: "ZERO_BUDGET_SELECTION",
    order: [
      "aspas",
      "leo",
      "chichoo",
      "chronicle",
      "zmjjkk",
      "less",
      "mako",
      "forsaken",
      "nobody",
      "boaster",
    ],
    lotIndex: 2,
    teams: {
      A: { budget: 0, roster: ["aspas"] },
      B: { budget: 5, roster: ["leo"] },
    },
    bidding: null,
    zeroBudget: { zeroTeam: "A", solventTeam: "B", actor: "B" },
  };
}

export function completeRosters(offset = 0) {
  const rotated = PLAYER_IDS.map(
    (_, index) => PLAYER_IDS[(index + offset) % PLAYER_IDS.length],
  );
  return { A: rotated.slice(0, 5), B: rotated.slice(5) };
}
