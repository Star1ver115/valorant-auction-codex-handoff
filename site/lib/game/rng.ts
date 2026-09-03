import type { PlayerCard, PlayerId, SeededRng } from "./types";

function hashSeed(seed: string): number {
  let hash = 0x811c9dc5;

  for (const byte of new TextEncoder().encode(seed)) {
    hash ^= byte;
    hash = Math.imul(hash, 0x01000193);
  }

  return hash >>> 0;
}

export function createRng(seed: string): SeededRng {
  let state = hashSeed(seed);

  const next = () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4_294_967_296;
  };

  return {
    next,
    int(maxExclusive) {
      if (!Number.isInteger(maxExclusive) || maxExclusive <= 0) {
        throw new RangeError("maxExclusive must be a positive integer");
      }
      return Math.floor(next() * maxExclusive);
    },
  };
}

function fisherYates<T>(values: readonly T[], rng: SeededRng): T[] {
  const shuffled = [...values];

  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = rng.int(index + 1);
    [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]];
  }

  return shuffled;
}

function isPremium(player: PlayerCard) {
  return player.tier === "T0" || player.tier === "T0.5";
}

function isValidOrder(players: readonly PlayerCard[]) {
  const avoidsThreeOfOneTier = players.every(
    (player, index) =>
      index < 2 ||
      !(player.tier === players[index - 1].tier && player.tier === players[index - 2].tier),
  );
  const finalPair = players.slice(-2);

  return avoidsThreeOfOneTier && finalPair.filter(isPremium).length < 2;
}

function backtrackOrder(players: readonly PlayerCard[]): PlayerCard[] | undefined {
  const order: PlayerCard[] = [];
  const used = new Set<PlayerId>();

  function placeNext(): boolean {
    if (order.length === players.length) {
      return isValidOrder(order);
    }

    for (const player of players) {
      if (used.has(player.id)) continue;

      const prior = order.at(-1);
      const beforePrior = order.at(-2);
      if (prior && beforePrior && prior.tier === player.tier && beforePrior.tier === player.tier) {
        continue;
      }

      order.push(player);
      used.add(player.id);

      const remaining = players.filter((candidate) => !used.has(candidate.id));
      const strandsPremiumFinalPair =
        remaining.length === 2 && remaining.every(isPremium);

      if (!strandsPremiumFinalPair && placeNext()) return true;

      used.delete(player.id);
      order.pop();
    }

    return false;
  }

  return placeNext() ? order : undefined;
}

export function shuffleAuctionOrder(
  players: readonly PlayerCard[],
  rng: SeededRng,
): PlayerId[] {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    const candidate = fisherYates(players, rng);
    if (isValidOrder(candidate)) return candidate.map((player) => player.id);
  }

  const fallback = backtrackOrder(fisherYates(players, rng));
  if (!fallback) throw new Error("Unable to produce a valid auction order");
  return fallback.map((player) => player.id);
}
