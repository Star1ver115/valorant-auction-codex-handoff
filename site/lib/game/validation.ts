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
