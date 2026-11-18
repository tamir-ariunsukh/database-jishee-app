import type { RequestHandler } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../env.js';
import { ApiError } from '../lib/http.js';

export type Role = 'customer' | 'admin' | 'driver';

export interface AuthUser {
  id: string;
  email: string;
  role: Role;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

const bearer = (header?: string): string | null => {
  if (!header) return null;
  const [scheme, token] = header.split(' ');
  if (!token || scheme.toLowerCase() !== 'bearer') return null;
  return token;
};

export function signToken(user: AuthUser): string {
  return jwt.sign(
    { sub: user.id, email: user.email, role: user.role },
    env.jwtSecret,
    { expiresIn: env.jwtExpiresIn as jwt.SignOptions['expiresIn'] },
  );
}

export function verifyToken(token: string, options?: jwt.VerifyOptions): AuthUser {
  const payload = jwt.verify(token, env.jwtSecret, options) as jwt.JwtPayload & {
    sub?: string;
    email?: string;
    role?: Role;
  };
  if (!payload.sub || !payload.role) {
    throw new ApiError(401, 'Токен хүчингүй');
  }
  return { id: payload.sub, email: payload.email ?? '', role: payload.role };
}

export const optionalAuth: RequestHandler = (req, _res, next) => {
  const token = bearer(req.headers.authorization);
  if (token) {
    try {
      req.user = verifyToken(token);
    } catch {
      // ignore invalid tokens for public endpoints
    }
  }
  next();
};

export const requireAuth: RequestHandler = (req, _res, next) => {
  if (!req.user) {
    throw new ApiError(401, 'Нэвтэрч орно уу');
  }
  next();
};

export const requireRole = (...roles: Role[]): RequestHandler => {
  return (req, _res, next) => {
    if (!req.user) throw new ApiError(401, 'Нэвтэрч орно уу');
    if (!roles.includes(req.user.role)) {
      throw new ApiError(403, 'Энэ үйлдлийг хийх эрх байхгүй');
    }
    next();
  };
};
