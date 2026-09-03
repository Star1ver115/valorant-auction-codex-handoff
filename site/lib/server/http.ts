import type { GameAction, TeamId } from "@/lib/game/types";
import { DomainError, isPlainRecord, requireTrimmedString } from "@/lib/game/validation";
import { RoomError } from "./rooms";
import type { JoinKind } from "./rooms";

export function json(data: unknown, status = 200) {
  return Response.json(data, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

export function errorResponse(error: unknown) {
  if (error instanceof RoomError) {
    return json(
      { error: { code: error.code, message: error.message }, current: error.current },
      error.status,
    );
  }
  if (error instanceof DomainError || error instanceof SyntaxError) {
    return json(
      {
        error: {
          code: error instanceof DomainError ? error.code : "INVALID_JSON",
          message: error.message,
        },
      },
      400,
    );
  }
  return json({ error: { code: "INTERNAL_ERROR", message: "Unexpected server error" } }, 500);
}

export async function readObject(request: Request) {
  const value: unknown = await request.json();
  if (!isPlainRecord(value)) throw new DomainError("INVALID_PAYLOAD", "JSON body must be an object");
  return value;
}

function parseTeam(value: unknown): TeamId {
  if (value !== "A" && value !== "B") throw new DomainError("INVALID_PAYLOAD", "actor must be A or B");
  return value;
}

export function parseGameAction(value: unknown): GameAction {
  if (!isPlainRecord(value) || typeof value.type !== "string") {
    throw new DomainError("INVALID_PAYLOAD", "action is invalid");
  }
  if (value.type === "START_GAME") return { type: "START_GAME" };
  const actor = parseTeam(value.actor);
  if (value.type === "BID") {
    if (typeof value.amount !== "number" || !Number.isInteger(value.amount)) {
      throw new DomainError("INVALID_PAYLOAD", "bid amount must be an integer");
    }
    return { type: "BID", actor, amount: value.amount };
  }
  if (value.type === "PASS") return { type: "PASS", actor };
  if (value.type === "ZERO_CHOICE" && (value.choice === "TAKE" || value.choice === "DECLINE")) {
    return { type: "ZERO_CHOICE", actor, choice: value.choice };
  }
  throw new DomainError("INVALID_PAYLOAD", "action type is unsupported");
}

export function parseCreateBody(body: Record<string, unknown>) {
  return { nickname: requireTrimmedString(body, "nickname", 24) };
}

export function parseJoinBody(body: Record<string, unknown>): {
  nickname: string;
  requestedRole: JoinKind;
} {
  const nickname = requireTrimmedString(body, "nickname", 24);
  if (body.requestedRole !== "PLAYER" && body.requestedRole !== "SPECTATOR") {
    throw new DomainError("INVALID_PAYLOAD", "requestedRole must be PLAYER or SPECTATOR");
  }
  return { nickname, requestedRole: body.requestedRole };
}

export function parseActionBody(body: Record<string, unknown>) {
  const seatToken = requireTrimmedString(body, "seatToken", 256);
  const actionId = requireTrimmedString(body, "actionId", 80);
  if (typeof body.expectedVersion !== "number" || !Number.isInteger(body.expectedVersion) || body.expectedVersion < 0) {
    throw new DomainError("INVALID_PAYLOAD", "expectedVersion must be a non-negative integer");
  }
  return {
    seatToken,
    actionId,
    expectedVersion: body.expectedVersion,
    action: parseGameAction(body.action),
  };
}
