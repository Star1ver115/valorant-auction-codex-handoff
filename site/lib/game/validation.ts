export class DomainError extends Error {
  constructor(
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "DomainError";
  }
}

export function assertPositiveInteger(value: number, label: string) {
  if (!Number.isInteger(value)) {
    throw new DomainError("NOT_INTEGER", `${label} must be an integer`);
  }
  if (value <= 0) {
    throw new DomainError("NOT_POSITIVE", `${label} must be positive`);
  }
}

export function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function requireTrimmedString(
  record: Record<string, unknown>,
  key: string,
  maxLength: number,
) {
  const value = record[key];
  if (typeof value !== "string" || !value.trim() || value.trim().length > maxLength) {
    throw new DomainError("INVALID_PAYLOAD", `${key} must contain 1–${maxLength} characters`);
  }
  return value.trim();
}
