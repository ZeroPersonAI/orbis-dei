// Port of src-tauri/src/error.rs — a single error type carrying a kind + message.
// The HTTP layer serialises these as { error: "<kind>: <message>" } to match the
// string-error contract the Tauri frontend already expects.

export type AppErrorKind =
  | "io"
  | "sqlite"
  | "git"
  | "serde"
  | "not_found"
  | "invalid_input"
  | "rate_limited"
  | "missing_config"
  | "cancelled"
  | "internal";

export class AppError extends Error {
  kind: AppErrorKind;
  retryAfterSecs?: number | null;

  constructor(kind: AppErrorKind, message: string, retryAfterSecs?: number | null) {
    super(message);
    this.kind = kind;
    this.name = "AppError";
    this.retryAfterSecs = retryAfterSecs ?? null;
  }

  get isCancellation(): boolean {
    return this.kind === "cancelled";
  }

  /** Human string matching the Rust `Display` impl, e.g. "not found: foo". */
  toDisplay(): string {
    switch (this.kind) {
      case "io":
        return `io error: ${this.message}`;
      case "sqlite":
        return `sqlite error: ${this.message}`;
      case "git":
        return `git error: ${this.message}`;
      case "serde":
        return `serde error: ${this.message}`;
      case "not_found":
        return `not found: ${this.message}`;
      case "invalid_input":
        return `invalid input: ${this.message}`;
      case "rate_limited":
        return `anthropic rate limited (retry_after=${this.retryAfterSecs ?? null}s): ${this.message}`;
      case "missing_config":
        return `missing configuration: ${this.message}`;
      case "cancelled":
        return "cancelled";
      case "internal":
        return `internal: ${this.message}`;
    }
  }
}

export const notFound = (m: string) => new AppError("not_found", m);
export const invalidInput = (m: string) => new AppError("invalid_input", m);
export const missingConfig = (m: string) => new AppError("missing_config", m);
export const internal = (m: string) => new AppError("internal", m);
export const cancelled = () => new AppError("cancelled", "cancelled");
export const rateLimited = (message: string, retryAfterSecs?: number | null) =>
  new AppError("rate_limited", message, retryAfterSecs);

export function toAppError(e: unknown): AppError {
  if (e instanceof AppError) return e;
  if (e instanceof Error) return internal(e.message);
  return internal(String(e));
}
