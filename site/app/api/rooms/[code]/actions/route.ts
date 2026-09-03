import { errorResponse, json, parseActionBody, readObject } from "@/lib/server/http";
import { getRoomStore } from "@/lib/server/runtime";
import { applyRoomAction } from "@/lib/server/rooms";

type Context = { params: Promise<{ code: string }> };

export async function POST(request: Request, context: Context) {
  try {
    const { code } = await context.params;
    const body = parseActionBody(await readObject(request));
    return json(await applyRoomAction(getRoomStore(), code, body));
  } catch (error) {
    return errorResponse(error);
  }
}
