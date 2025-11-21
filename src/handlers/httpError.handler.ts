import { NextFunction, Request, Response } from 'express';
import { getErrorMessage } from './catchError.handler';

export class HttpError extends Error {
  statusCode: number = 400;
  constructor(statusCode: number, message: string | undefined) {
    super(message);
    this.statusCode = statusCode;
  }
}

export class UnauthorizedError extends HttpError {
  constructor(message: string | undefined) {
    super(401, message);
  }
}

export class BadRequestError extends HttpError {
  constructor(message: string | undefined) {
    super(400, message);
  }
}

export class ForbiddenError extends HttpError {
  constructor(message: string | undefined) {
    super(403, message);
  }
}

export class NotFoundError extends HttpError {
  constructor(message: string | undefined) {
    super(404, message);
  }
}

export class MethodNotAllowedError extends HttpError {
  constructor(message: string | undefined) {
    super(405, message);
  }
}

export class ConflictError extends HttpError {
  constructor(message: string | undefined) {
    super(409, message);
  }
}

export class UnprocessableEntityError extends HttpError {
  constructor(message: string | undefined) {
    super(422, message);
  }
}

export class InternalServerError extends HttpError {
  constructor(message: string | undefined) {
    super(500, message);
  }
}

export async function httpErrorHandler(
  err: Error,
  req: Request,
  res: Response,
  next: NextFunction
) {
  if (err instanceof HttpError) {
    return res.status(err.statusCode).json(getErrorMessage(err));
  }
  return res.status(400).json(getErrorMessage(err));
}
