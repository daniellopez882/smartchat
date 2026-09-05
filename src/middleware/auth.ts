import type { NextApiRequest, NextApiResponse } from 'next';
import { body, validationResult } from 'express-validator';
import rateLimit from 'express-rate-limit';
import jwt, { JwtPayload } from 'jsonwebtoken';

import { env, features } from '@/config/env';

export type AuthenticatedHandler = (
  req: NextApiRequest,
  res: NextApiResponse,
  userId: number
) => Promise<unknown> | unknown;

/** Bearer token from the Authorization header, or null. */
export const bearerToken = (req: NextApiRequest): string | null => {
  const header = req.headers.authorization;
  if (!header) return null;
  const [scheme, token] = header.split(' ');
  return scheme?.toLowerCase() === 'bearer' && token ? token : null;
};

/**
 * Protects a route: verifies the JWT and calls the handler with the user id.
 * Every API route except login is wrapped in this now; chat, upload,
 * screenshot and the remote-server tools used to be open.
 */
export function withAuth(handler: AuthenticatedHandler) {
  return async (req: NextApiRequest, res: NextApiResponse) => {
    const token = bearerToken(req);
    if (!token) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    const secret = env.JWT_SECRET;
    if (!secret) {
      console.error('JWT_SECRET is not set');
      return res.status(500).json({ error: 'Server is not configured' });
    }
    let userId: number;
    try {
      const decoded = jwt.verify(token, secret) as JwtPayload & { userId?: unknown };
      if (typeof decoded.userId !== 'number') throw new Error('Invalid token payload');
      userId = decoded.userId;
    } catch {
      return res.status(401).json({ error: 'Invalid token' });
    }
    return handler(req, res, userId);
  };
}

export const USERNAME_MIN = 3;
export const USERNAME_MAX = 30;
export const PASSWORD_MIN = 8;

/**
 * Validates the login body and returns the error messages.
 *
 * The previous version built the express-validator chain and returned it in
 * an array that nothing ever executed (`await validateLoginInput(req, res)`
 * awaited an array), so no validation ran. It also `.escape()`d the password,
 * which would have changed it before hashing. The chain runs now; the
 * password is checked for length only.
 */
export async function validateLogin(req: NextApiRequest): Promise<string[]> {
  await Promise.all([
    body('username')
      .isString()
      .withMessage('Username must be a string')
      .trim()
      .isLength({ min: USERNAME_MIN, max: USERNAME_MAX })
      .withMessage(`Username must be between ${USERNAME_MIN} and ${USERNAME_MAX} characters`)
      .run(req),
    body('password')
      .isString()
      .withMessage('Password must be a string')
      .isLength({ min: PASSWORD_MIN })
      .withMessage(`Password must be at least ${PASSWORD_MIN} characters`)
      .run(req)
  ]);
  return validationResult(req)
    .array()
    .map(e => e.msg as string);
}

/**
 * The address a request came from. X-Forwarded-For is only believed when
 * TRUST_PROXY=true; otherwise a client could pick its own rate-limit bucket.
 */
export const clientIp = (req: NextApiRequest): string => {
  if (features.trustProxy) {
    const forwarded = req.headers['x-forwarded-for'];
    const first = Array.isArray(forwarded) ? forwarded[0] : forwarded?.split(',')[0];
    if (first?.trim()) return first.trim();
  }
  return req.socket?.remoteAddress ?? 'unknown';
};

export const LOGIN_WINDOW_MS = 15 * 60 * 1000;
export const LOGIN_MAX_ATTEMPTS = 5;

export const loginLimiter = rateLimit({
  windowMs: LOGIN_WINDOW_MS,
  max: LOGIN_MAX_ATTEMPTS,
  message: { error: 'Too many login attempts from this IP, please try again after 15 minutes' },
  standardHeaders: true,
  legacyHeaders: false,
  validate: { xForwardedForHeader: false, trustProxy: false },
  keyGenerator: req => clientIp(req as unknown as NextApiRequest)
});

/** Run the limiter as a promise; resolves false when the request was rejected. */
export const applyLoginLimiter = (req: NextApiRequest, res: NextApiResponse): Promise<boolean> =>
  new Promise((resolve, reject) => {
    // express-rate-limit is Express middleware; the Next request/response are close enough.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    loginLimiter(req as any, res as any, (result: unknown) => {
      if (result instanceof Error) return reject(result);
      resolve(!res.writableEnded);
    });
    // When the limit is hit the middleware responds itself and never calls next().
    res.once('finish', () => resolve(false));
  });
