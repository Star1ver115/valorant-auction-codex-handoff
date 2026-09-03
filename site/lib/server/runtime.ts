import { env } from "cloudflare:workers";
import { D1RoomStore } from "./rooms";

export function getRoomStore() {
  return new D1RoomStore(env.DB as D1Database);
}
