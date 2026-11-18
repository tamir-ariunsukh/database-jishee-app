import type { NextFunction, Request, RequestHandler, Response } from 'express';
import type { ZodTypeAny } from 'zod';

export class ApiError extends Error {
  status: number;
  details?: unknown;

  constructor(status: number, message: string, details?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.details = details;
  }
}

type AsyncRoute = (req: Request, res: Response, next: NextFunction) => Promise<unknown> | unknown;

export const asyncHandler = (fn: AsyncRoute): RequestHandler => {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

export function parseBody<T extends ZodTypeAny>(schema: T, data: unknown): T['_output'] {
  const result = schema.safeParse(data);
  if (!result.success) {
    throw new ApiError(422, 'Оруулсан мэдээлэл буруу байна', result.error.flatten());
  }
  return result.data;
}

export function parseQuery<T extends ZodTypeAny>(schema: T, data: unknown): T['_output'] {
  const result = schema.safeParse(data);
  if (!result.success) {
    throw new ApiError(422, 'Query параметр буруу байна', result.error.flatten());
  }
  return result.data;
}

export interface PageMeta {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export function pageMeta(total: number, page: number, limit: number): PageMeta {
  return { total, page, limit, totalPages: Math.max(1, Math.ceil(total / limit)) };
}
