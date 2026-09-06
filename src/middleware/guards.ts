import type { NextApiRequest, NextApiResponse } from 'next';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type ApiHandler = (req: NextApiRequest, res: NextApiResponse, ...rest: any[]) => unknown;

/** 405 with an Allow header for anything but the listed methods. */
export function withMethods(methods: string[], handler: ApiHandler): ApiHandler {
  return (req, res, ...rest) => {
    if (!methods.includes(req.method ?? '')) {
      res.setHeader('Allow', methods);
      return res.status(405).json({ error: `Method ${req.method} not allowed` });
    }
    return handler(req, res, ...rest);
  };
}

/**
 * 404 unless the feature is switched on. Used for the tools that act on the
 * host machine or on cloud resources: they do not exist on a server that has
 * not opted in.
 */
export function requireFeature(
  enabled: () => boolean,
  name: string,
  handler: ApiHandler
): ApiHandler {
  return (req, res, ...rest) => {
    if (!enabled()) {
      return res.status(404).json({ error: `${name} is not enabled on this server` });
    }
    return handler(req, res, ...rest);
  };
}

/** A validation failure the handler turns into a 400. */
export class BadRequestError extends Error {
  constructor(
    message: string,
    public readonly details?: string[]
  ) {
    super(message);
  }
}

export const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);
