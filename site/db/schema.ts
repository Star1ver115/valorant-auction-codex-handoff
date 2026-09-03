import { index, integer, primaryKey, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

export const rooms = sqliteTable("rooms", {
  code: text("code").primaryKey(),
  seed: text("seed").notNull(),
  version: integer("version").notNull(),
  stateJson: text("state_json").notNull(),
  createdAt: integer("created_at").notNull(),
  lastActiveAt: integer("last_active_at").notNull(),
  spectatorsOpen: integer("spectators_open", { mode: "boolean" }).notNull().default(true),
}, (table) => [index("idx_rooms_last_active_at").on(table.lastActiveAt)]);

export const roomSeats = sqliteTable("room_seats", {
  roomCode: text("room_code").notNull().references(() => rooms.code, { onDelete: "cascade" }),
  role: text("role", { enum: ["A", "B", "SPECTATOR"] }).notNull(),
  tokenHash: text("token_hash").notNull(),
  nickname: text("nickname").notNull(),
  lastSeenAt: integer("last_seen_at").notNull(),
}, (table) => [
  primaryKey({ columns: [table.roomCode, table.role, table.tokenHash] }),
  index("idx_room_seats_room_role").on(table.roomCode, table.role),
]);

export const roomEvents = sqliteTable("room_events", {
  roomCode: text("room_code").notNull().references(() => rooms.code, { onDelete: "cascade" }),
  version: integer("version").notNull(),
  actionId: text("action_id").notNull(),
  eventJson: text("event_json").notNull(),
  stateJson: text("state_json").notNull(),
  createdAt: integer("created_at").notNull(),
}, (table) => [
  primaryKey({ columns: [table.roomCode, table.version] }),
  uniqueIndex("idx_room_events_action").on(table.roomCode, table.actionId),
  index("idx_room_events_room_version").on(table.roomCode, table.version),
]);
