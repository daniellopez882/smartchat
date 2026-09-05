import { EventEmitter } from 'node:events';
import type { NextApiRequest, NextApiResponse } from 'next';
import jwt from 'jsonwebtoken';

export interface MockResponse extends NextApiResponse {
  statusCode: number;
  body: unknown;
  headers: Record<string, unknown>;
  writableEnded: boolean;
}

export interface ReqInit {
  method?: string;
  body?: unknown;
  headers?: Record<string, string>;
  query?: Record<string, string>;
  ip?: string;
}

/** A request object with what the handlers and express-rate-limit read. */
export function createReq(init: ReqInit = {}): NextApiRequest {
  const req = new EventEmitter() as unknown as NextApiRequest;
  Object.assign(req, {
    method: init.method ?? 'GET',
    body: init.body,
    headers: Object.fromEntries(
      Object.entries(init.headers ?? {}).map(([k, v]) => [k.toLowerCase(), v])
    ),
    query: init.query ?? {},
    cookies: {},
    url: '/api/test',
    socket: { remoteAddress: init.ip ?? '127.0.0.1' }
  });
  return req;
}

export function createRes(): MockResponse {
  const emitter = new EventEmitter();
  const res = emitter as unknown as MockResponse;
  res.statusCode = 200;
  res.body = undefined;
  res.headers = {};
  res.writableEnded = false;
  const finish = (payload?: unknown) => {
    if (payload !== undefined) res.body = payload;
    res.writableEnded = true;
    emitter.emit('finish');
    return res;
  };
  res.status = (code: number) => {
    res.statusCode = code;
    return res;
  };
  res.json = finish;
  res.send = finish;
  res.end = finish as MockResponse['end'];
  res.setHeader = (name: string, value: unknown) => {
    res.headers[name.toLowerCase()] = value;
    return res;
  };
  res.getHeader = (name: string) => res.headers[name.toLowerCase()] as string | undefined;
  res.removeHeader = (name: string) => {
    delete res.headers[name.toLowerCase()];
  };
  return res;
}

export const signToken = (userId: number, secret = process.env.JWT_SECRET as string) =>
  jwt.sign({ userId }, secret, { expiresIn: '1h' });

export const authHeaders = (userId: number) => ({ authorization: `Bearer ${signToken(userId)}` });

type Handler = (req: NextApiRequest, res: NextApiResponse) => unknown;

/** Run a handler and return the response. */
export async function call(handler: Handler, init: ReqInit = {}): Promise<MockResponse> {
  const res = createRes();
  await handler(createReq(init), res);
  return res;
}
