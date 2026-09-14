export class UnauthorizedError extends Error {
  readonly status = 401;
  constructor(message = "Authentication required") {
    super(message);
    this.name = "UnauthorizedError";
  }
}

export class ForbiddenError extends Error {
  readonly status = 403;
  constructor(message = "Access denied") {
    super(message);
    this.name = "ForbiddenError";
  }
}

export class NotFoundError extends Error {
  readonly status = 404;
  constructor(message = "Project not found") {
    super(message);
    this.name = "NotFoundError";
  }
}

export class RateLimitError extends Error {
  readonly status = 429;
  constructor(message = "Too many requests") {
    super(message);
    this.name = "RateLimitError";
  }
}

export class ValidationError extends Error {
  readonly status = 400;
  constructor(message = "Invalid request") {
    super(message);
    this.name = "ValidationError";
  }
}
