export class ApiError extends Error {
  public readonly status: number | null;
  public readonly code: string | null;
  public readonly errors: unknown;

  constructor(
    message: string,
    status: number | null,
    code: string | null = null,
    errors: unknown = null,
  ) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.errors = errors;
  }
}
