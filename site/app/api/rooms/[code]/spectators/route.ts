import { errorResponse, json, parseSpectatorSettingsBody, readObject } from "@/lib/server/http";
import { getRoomStore } from "@/lib/server/runtime";
import { setRoomSpectatorsOpen } from "@/lib/server/rooms";

type Context = { params: Promise<{ code: string }> };

export async function PATCH(request: Request, context: Context) {
  try {
    const { code } = await context.params;
    const body = parseSpectatorSettingsBody(await readObject(request));
    return json(await setRoomSpectatorsOpen(getRoomStore(), code, body.seatToken, body.open));
  } catch (error) {
    return errorResponse(error);
  }
}
