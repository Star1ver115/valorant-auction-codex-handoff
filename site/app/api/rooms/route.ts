import { createRoom } from "@/lib/server/rooms";
import { errorResponse, json, parseCreateBody, readObject } from "@/lib/server/http";
import { getRoomStore } from "@/lib/server/runtime";

export async function POST(request: Request) {
  try {
    const { nickname } = parseCreateBody(await readObject(request));
    return json(await createRoom(getRoomStore(), nickname), 201);
  } catch (error) {
    return errorResponse(error);
  }
}
