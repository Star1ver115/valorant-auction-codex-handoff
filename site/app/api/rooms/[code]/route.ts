import { errorResponse, json, parseJoinBody, readObject } from "@/lib/server/http";
import { getRoomStore } from "@/lib/server/runtime";
import { joinRoom, readRoom } from "@/lib/server/rooms";

type Context = { params: Promise<{ code: string }> };

export async function GET(_request: Request, context: Context) {
  try {
    const { code } = await context.params;
    return json(await readRoom(getRoomStore(), code));
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: Request, context: Context) {
  try {
    const { code } = await context.params;
    const { nickname, requestedRole } = parseJoinBody(await readObject(request));
    return json(await joinRoom(getRoomStore(), code, nickname, requestedRole));
  } catch (error) {
    return errorResponse(error);
  }
}
