import { createGame, publicSnapshot, reduceGame } from "@/lib/game/engine";
import type { DomainEvent, GameAction, GameState, PublicGameSnapshot, TeamId } from "@/lib/game/types";
import { DomainError } from "@/lib/game/validation";
import { createSeatToken, hashSeatToken, tokenMatches } from "./auth";

const ROOM_LIFETIME_MS = 24 * 60 * 60 * 1000;
const SPECTATOR_CAPACITY = 3;
const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export type RoomRole = TeamId | "SPECTATOR";
export type JoinKind = "PLAYER" | "SPECTATOR";

export type StoredRoom = {
  code: string;
  seed: string;
  version: number;
  stateJson: string;
  createdAt: number;
  lastActiveAt: number;
  spectatorsOpen: boolean;
};

export type StoredSeat = {
  roomCode: string;
  role: RoomRole;
  tokenHash: string;
  nickname: string;
  lastSeenAt: number;
};

export type StoredRoomEvent = {
  roomCode: string;
  version: number;
  actionId: string;
  eventJson: string;
  stateJson: string;
  createdAt: number;
};

export interface RoomStore {
  getRoom(code: string): Promise<StoredRoom | null>;
  insertRoom(room: StoredRoom, host: StoredSeat): Promise<boolean>;
  listSeats(code: string): Promise<StoredSeat[]>;
  addSeat(seat: StoredSeat, spectatorCapacity: number): Promise<boolean>;
  updateLobbyState(code: string, stateJson: string, now: number): Promise<void>;
  setSpectatorsOpen(code: string, open: boolean, now: number): Promise<void>;
  getAction(code: string, actionId: string): Promise<StoredRoomEvent | null>;
  listEvents(code: string): Promise<StoredRoomEvent[]>;
  commitAction(args: {
    code: string;
    expectedVersion: number;
    stateJson: string;
    eventJson: string;
    actionId: string;
    now: number;
  }): Promise<boolean>;
}

export class RoomError extends DomainError {
  constructor(
    code: string,
    message: string,
    readonly status: number,
    readonly current?: SnapshotResponse,
  ) {
    super(code, message);
  }
}

export type SnapshotResponse = {
  version: number;
  snapshot: PublicGameSnapshot;
  events: DomainEvent[];
  spectatorCount: number;
  spectatorsOpen: boolean;
};

export type JoinRoomResponse = SnapshotResponse & {
  code: string;
  role: RoomRole;
  seatToken: string;
};

function normalizeCode(code: string) {
  return code.trim().toUpperCase();
}

function randomCode() {
  const bytes = new Uint8Array(6);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => CODE_ALPHABET[byte % CODE_ALPHABET.length]).join("");
}

function roomState(room: StoredRoom) {
  return JSON.parse(room.stateJson) as GameState;
}

function assertLive(room: StoredRoom | null, now: number): asserts room is StoredRoom {
  if (!room || now - room.lastActiveAt > ROOM_LIFETIME_MS) {
    throw new RoomError("ROOM_NOT_FOUND", "Room was not found or has expired", 404);
  }
}

async function snapshotFrom(store: RoomStore, room: StoredRoom): Promise<SnapshotResponse> {
  const [seats, allRecords] = await Promise.all([store.listSeats(room.code), store.listEvents(room.code)]);
  const records = allRecords.filter((record) => record.version <= room.version);
  return {
    version: room.version,
    snapshot: publicSnapshot(roomState(room)),
    events: records.flatMap((record) => JSON.parse(record.eventJson) as DomainEvent[]),
    spectatorCount: seats.filter((seat) => seat.role === "SPECTATOR").length,
    spectatorsOpen: room.spectatorsOpen,
  };
}

export async function createRoom(
  store: RoomStore,
  nickname: string,
  options: { now?: number; code?: string; seed?: string } = {},
): Promise<JoinRoomResponse> {
  const safeNickname = nickname.trim();
  if (!safeNickname || safeNickname.length > 24) {
    throw new RoomError("INVALID_NICKNAME", "Nickname must contain 1–24 characters", 400);
  }
  const now = options.now ?? Date.now();
  const code = normalizeCode(options.code ?? randomCode());
  const seed = options.seed ?? `room-${code}-${now}`;
  const seatToken = createSeatToken();
  const state = createGame(seed, {
    A: { nickname: safeNickname },
    B: { nickname: "等待加入" },
  });
  const room: StoredRoom = {
    code,
    seed,
    version: 0,
    stateJson: JSON.stringify(state),
    createdAt: now,
    lastActiveAt: now,
    spectatorsOpen: true,
  };
  const host: StoredSeat = {
    roomCode: code,
    role: "A",
    tokenHash: await hashSeatToken(seatToken),
    nickname: safeNickname,
    lastSeenAt: now,
  };
  if (!(await store.insertRoom(room, host))) {
    throw new RoomError("ROOM_CODE_COLLISION", "Could not allocate a unique room code", 409);
  }
  return { ...(await snapshotFrom(store, room)), code, role: "A", seatToken };
}

export async function joinRoom(
  store: RoomStore,
  code: string,
  nickname: string,
  requestedRole: JoinKind,
  now = Date.now(),
): Promise<JoinRoomResponse> {
  const safeNickname = nickname.trim();
  if (!safeNickname || safeNickname.length > 24) {
    throw new RoomError("INVALID_NICKNAME", "Nickname must contain 1–24 characters", 400);
  }
  const roomCode = normalizeCode(code);
  const room = await store.getRoom(roomCode);
  assertLive(room, now);
  if (requestedRole !== "PLAYER" && requestedRole !== "SPECTATOR") {
    throw new RoomError("INVALID_ROLE", "Requested role is invalid", 400);
  }
  if (requestedRole === "SPECTATOR" && !room.spectatorsOpen) {
    throw new RoomError("SPECTATORS_CLOSED", "New spectators are not allowed", 403);
  }

  const seatToken = createSeatToken();
  const role: RoomRole = requestedRole === "PLAYER" ? "B" : "SPECTATOR";
  const seat: StoredSeat = {
    roomCode,
    role,
    tokenHash: await hashSeatToken(seatToken),
    nickname: safeNickname,
    lastSeenAt: now,
  };
  if (!(await store.addSeat(seat, SPECTATOR_CAPACITY))) {
    throw requestedRole === "SPECTATOR"
      ? new RoomError("SPECTATOR_CAPACITY", "This room already has three spectators", 429)
      : new RoomError("PLAYER_CAPACITY", "Both player seats are occupied", 409);
  }

  let currentRoom = room;
  if (role === "B") {
    const state = roomState(room);
    state.players.B.nickname = safeNickname;
    const created = state.eventLog.find((event) => event.type === "GAME_CREATED");
    if (created?.type === "GAME_CREATED") created.players.B.nickname = safeNickname;
    const stateJson = JSON.stringify(state);
    await store.updateLobbyState(roomCode, stateJson, now);
    currentRoom = { ...room, stateJson, lastActiveAt: now };
  }
  return { ...(await snapshotFrom(store, currentRoom)), code: roomCode, role, seatToken };
}

export async function readRoom(store: RoomStore, code: string, now = Date.now()) {
  const room = await store.getRoom(normalizeCode(code));
  assertLive(room, now);
  return snapshotFrom(store, room);
}

export async function setRoomSpectatorsOpen(
  store: RoomStore,
  code: string,
  seatToken: string,
  open: boolean,
  now = Date.now(),
) {
  const roomCode = normalizeCode(code);
  const room = await store.getRoom(roomCode);
  assertLive(room, now);
  const seat = await findAuthorizedSeat(store, roomCode, seatToken);
  if (seat.role !== "A") {
    throw new RoomError("WRONG_SEAT", "Only the host can change spectator access", 403);
  }
  await store.setSpectatorsOpen(roomCode, open, now);
  return snapshotFrom(store, { ...room, spectatorsOpen: open, lastActiveAt: now });
}

async function findAuthorizedSeat(store: RoomStore, code: string, token: string) {
  const seats = await store.listSeats(code);
  let authorized: StoredSeat | null = null;
  for (const seat of seats) {
    if (await tokenMatches(seat.tokenHash, token)) authorized = seat;
  }
  if (!authorized) throw new RoomError("INVALID_TOKEN", "Seat token is invalid", 401);
  return authorized;
}

function assertSeatCanAct(seat: StoredSeat, action: GameAction) {
  if (seat.role === "SPECTATOR") {
    throw new RoomError("SPECTATOR_READ_ONLY", "Spectators cannot submit actions", 403);
  }
  if (action.type === "START_GAME") {
    if (seat.role !== "A") throw new RoomError("WRONG_SEAT", "Only the host can start", 403);
  } else if (action.actor !== seat.role) {
    throw new RoomError("WRONG_SEAT", "Action actor does not match the seat token", 403);
  }
}

export async function applyRoomAction(
  store: RoomStore,
  code: string,
  request: {
    seatToken: string;
    expectedVersion: number;
    actionId: string;
    action: GameAction;
    now?: number;
  },
): Promise<SnapshotResponse> {
  const roomCode = normalizeCode(code);
  const now = request.now ?? Date.now();
  const room = await store.getRoom(roomCode);
  assertLive(room, now);
  const seat = await findAuthorizedSeat(store, roomCode, request.seatToken);
  assertSeatCanAct(seat, request.action);
  if (request.action.type === "START_GAME") {
    const seats = await store.listSeats(roomCode);
    if (!seats.some((candidate) => candidate.role === "B")) {
      throw new RoomError("WAITING_FOR_PLAYER", "The second player has not joined", 409, await snapshotFrom(store, room));
    }
  }

  const duplicate = await store.getAction(roomCode, request.actionId);
  if (duplicate) {
    return snapshotFrom(store, { ...room, version: duplicate.version, stateJson: duplicate.stateJson });
  }
  if (request.expectedVersion !== room.version) {
    throw new RoomError("STALE_VERSION", "Room version is stale", 409, await snapshotFrom(store, room));
  }

  const transition = reduceGame(roomState(room), request.action);
  const stateJson = JSON.stringify(transition.state);
  const committed = await store.commitAction({
    code: roomCode,
    expectedVersion: request.expectedVersion,
    stateJson,
    eventJson: JSON.stringify(transition.events),
    actionId: request.actionId,
    now,
  });
  if (!committed) {
    const latest = await store.getRoom(roomCode);
    assertLive(latest, now);
    throw new RoomError("STALE_VERSION", "Room version changed", 409, await snapshotFrom(store, latest));
  }
  return snapshotFrom(store, {
    ...room,
    version: room.version + 1,
    stateJson,
    lastActiveAt: now,
  });
}

export class MemoryRoomStore implements RoomStore {
  private rooms = new Map<string, StoredRoom>();
  private seats: StoredSeat[] = [];
  private events: StoredRoomEvent[] = [];

  async getRoom(code: string) { return structuredClone(this.rooms.get(code) ?? null); }

  async insertRoom(room: StoredRoom, host: StoredSeat) {
    if (this.rooms.has(room.code)) return false;
    this.rooms.set(room.code, structuredClone(room));
    this.seats.push(structuredClone(host));
    return true;
  }

  async listSeats(code: string) {
    return structuredClone(this.seats.filter((seat) => seat.roomCode === code));
  }

  async addSeat(seat: StoredSeat, spectatorCapacity: number) {
    const matching = this.seats.filter((candidate) => candidate.roomCode === seat.roomCode);
    if (seat.role === "B" && matching.some((candidate) => candidate.role === "B")) return false;
    if (seat.role === "SPECTATOR" && matching.filter((candidate) => candidate.role === "SPECTATOR").length >= spectatorCapacity) return false;
    this.seats.push(structuredClone(seat));
    return true;
  }

  async updateLobbyState(code: string, stateJson: string, now: number) {
    const room = this.rooms.get(code);
    if (room) this.rooms.set(code, { ...room, stateJson, lastActiveAt: now });
  }

  async setSpectatorsOpen(code: string, open: boolean, now: number) {
    const room = this.rooms.get(code);
    if (room) this.rooms.set(code, { ...room, spectatorsOpen: open, lastActiveAt: now });
  }

  async getAction(code: string, actionId: string) {
    return structuredClone(this.events.find((event) => event.roomCode === code && event.actionId === actionId) ?? null);
  }

  async listEvents(code: string) {
    return structuredClone(this.events.filter((event) => event.roomCode === code).sort((a, b) => a.version - b.version));
  }

  async commitAction(args: { code: string; expectedVersion: number; stateJson: string; eventJson: string; actionId: string; now: number }) {
    const room = this.rooms.get(args.code);
    if (!room || room.version !== args.expectedVersion) return false;
    if (this.events.some((event) => event.roomCode === args.code && event.actionId === args.actionId)) return true;
    const version = args.expectedVersion + 1;
    this.rooms.set(args.code, { ...room, version, stateJson: args.stateJson, lastActiveAt: args.now });
    this.events.push({ roomCode: args.code, version, actionId: args.actionId, eventJson: args.eventJson, stateJson: args.stateJson, createdAt: args.now });
    return true;
  }

  debugSeats(code: string) { return this.seats.filter((seat) => seat.roomCode === code); }
  debugEvents(code: string) { return this.events.filter((event) => event.roomCode === code); }
}

export class D1RoomStore implements RoomStore {
  constructor(private readonly db: D1Database) {}

  async getRoom(code: string) {
    const row = await this.db.prepare("SELECT code, seed, version, state_json, created_at, last_active_at, spectators_open FROM rooms WHERE code = ?").bind(code).first<Record<string, unknown>>();
    return row ? mapRoom(row) : null;
  }

  async insertRoom(room: StoredRoom, host: StoredSeat) {
    try {
      await this.db.batch([
        this.db.prepare("INSERT INTO rooms (code, seed, version, state_json, created_at, last_active_at, spectators_open) VALUES (?, ?, ?, ?, ?, ?, ?)").bind(room.code, room.seed, room.version, room.stateJson, room.createdAt, room.lastActiveAt, room.spectatorsOpen ? 1 : 0),
        this.db.prepare("INSERT INTO room_seats (room_code, role, token_hash, nickname, last_seen_at) VALUES (?, ?, ?, ?, ?)").bind(host.roomCode, host.role, host.tokenHash, host.nickname, host.lastSeenAt),
      ]);
      return true;
    } catch { return false; }
  }

  async listSeats(code: string) {
    const result = await this.db.prepare("SELECT room_code, role, token_hash, nickname, last_seen_at FROM room_seats WHERE room_code = ?").bind(code).all<Record<string, unknown>>();
    return result.results.map(mapSeat);
  }

  async addSeat(seat: StoredSeat, spectatorCapacity: number) {
    const statement = seat.role === "SPECTATOR"
      ? this.db.prepare("INSERT INTO room_seats (room_code, role, token_hash, nickname, last_seen_at) SELECT ?, ?, ?, ?, ? WHERE (SELECT spectators_open FROM rooms WHERE code = ?) = 1 AND (SELECT COUNT(*) FROM room_seats WHERE room_code = ? AND role = 'SPECTATOR') < ?").bind(seat.roomCode, seat.role, seat.tokenHash, seat.nickname, seat.lastSeenAt, seat.roomCode, seat.roomCode, spectatorCapacity)
      : this.db.prepare("INSERT INTO room_seats (room_code, role, token_hash, nickname, last_seen_at) SELECT ?, ?, ?, ?, ? WHERE NOT EXISTS (SELECT 1 FROM room_seats WHERE room_code = ? AND role = ?)").bind(seat.roomCode, seat.role, seat.tokenHash, seat.nickname, seat.lastSeenAt, seat.roomCode, seat.role);
    const result = await statement.run();
    return Number(result.meta.changes ?? 0) === 1;
  }

  async updateLobbyState(code: string, stateJson: string, now: number) {
    await this.db.prepare("UPDATE rooms SET state_json = ?, last_active_at = ? WHERE code = ? AND version = 0").bind(stateJson, now, code).run();
  }

  async setSpectatorsOpen(code: string, open: boolean, now: number) {
    await this.db.prepare("UPDATE rooms SET spectators_open = ?, last_active_at = ? WHERE code = ?").bind(open ? 1 : 0, now, code).run();
  }

  async getAction(code: string, actionId: string) {
    const row = await this.db.prepare("SELECT room_code, version, action_id, event_json, state_json, created_at FROM room_events WHERE room_code = ? AND action_id = ?").bind(code, actionId).first<Record<string, unknown>>();
    return row ? mapEvent(row) : null;
  }

  async listEvents(code: string) {
    const result = await this.db.prepare("SELECT room_code, version, action_id, event_json, state_json, created_at FROM room_events WHERE room_code = ? ORDER BY version").bind(code).all<Record<string, unknown>>();
    return result.results.map(mapEvent);
  }

  async commitAction(args: { code: string; expectedVersion: number; stateJson: string; eventJson: string; actionId: string; now: number }) {
    try {
      const results = await this.db.batch([
        this.db.prepare("UPDATE rooms SET version = version + 1, state_json = ?, last_active_at = ? WHERE code = ? AND version = ?").bind(args.stateJson, args.now, args.code, args.expectedVersion),
        this.db.prepare("INSERT INTO room_events (room_code, version, action_id, event_json, state_json, created_at) VALUES (?, ?, ?, ?, ?, ?)").bind(args.code, args.expectedVersion + 1, args.actionId, args.eventJson, args.stateJson, args.now),
      ]);
      return Number(results[0].meta.changes ?? 0) === 1;
    } catch { return false; }
  }
}

function mapRoom(row: Record<string, unknown>): StoredRoom {
  return { code: String(row.code), seed: String(row.seed), version: Number(row.version), stateJson: String(row.state_json), createdAt: Number(row.created_at), lastActiveAt: Number(row.last_active_at), spectatorsOpen: Boolean(row.spectators_open) };
}

function mapSeat(row: Record<string, unknown>): StoredSeat {
  return { roomCode: String(row.room_code), role: String(row.role) as RoomRole, tokenHash: String(row.token_hash), nickname: String(row.nickname), lastSeenAt: Number(row.last_seen_at) };
}

function mapEvent(row: Record<string, unknown>): StoredRoomEvent {
  return { roomCode: String(row.room_code), version: Number(row.version), actionId: String(row.action_id), eventJson: String(row.event_json), stateJson: String(row.state_json), createdAt: Number(row.created_at) };
}
