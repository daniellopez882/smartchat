import jwt from 'jsonwebtoken';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { call, createReq } from '../helpers/http';
import { setNodeEnv } from '../setup';
import { clientIp, LOGIN_MAX_ATTEMPTS } from '@/src/middleware/auth';
import { createDataSource, setAppDataSource } from '@/src/db';
import handler, { DEFAULT_CREDENTIALS_REFUSED } from '@/src/pages/api/auth/login';

let ipCounter = 0;
/** A fresh source address per test so the login limiter does not carry over. */
const nextIp = () => `10.0.0.${++ipCounter}`;

beforeAll(async () => {
  setAppDataSource(await createDataSource({ database: ':memory:' }));
});

afterEach(() => {
  setNodeEnv('test');
  delete process.env.ALLOW_DEFAULT_CREDENTIALS;
  delete process.env.TRUST_PROXY;
});

const login = (body: unknown, ip = nextIp()) => call(handler, { method: 'POST', body, ip });

describe('POST /api/auth/login', () => {
  it('rejects anything but POST', async () => {
    const res = await call(handler, { method: 'GET', ip: nextIp() });
    expect(res.statusCode).toBe(405);
  });

  it('validates the body — the old validators were never executed', async () => {
    const res = await login({ username: 'ab', password: 'short' });
    expect(res.statusCode).toBe(400);
    expect(res.body).toMatchObject({ error: 'Invalid input' });
    const details = (res.body as { details: string[] }).details.join(' ');
    expect(details).toMatch(/Username must be between/);
    expect(details).toMatch(/Password must be at least/);
  });

  it('refuses unknown users without creating anyone', async () => {
    const res = await login({ username: 'stranger', password: 'password123' });
    expect(res.statusCode).toBe(401);
  });

  it('creates the single user on first login with the configured defaults and returns a JWT', async () => {
    const res = await login({ username: 'tester', password: 'password123' });
    expect(res.statusCode).toBe(200);
    const { token } = res.body as { token: string };
    const payload = jwt.verify(token, process.env.JWT_SECRET as string) as { userId: number };
    expect(payload.userId).toBe(1);

    const wrong = await login({ username: 'tester', password: 'password124' });
    expect(wrong.statusCode).toBe(401);
  });

  it('refuses the .env.example credentials in production unless explicitly allowed', async () => {
    process.env.DEFAULT_USERNAME = 'admin';
    process.env.DEFAULT_PASSWORD = 'smartchat';
    setNodeEnv('production');
    const refused = await login({ username: 'admin', password: 'smartchat' });
    expect(refused.statusCode).toBe(403);
    expect(refused.body).toEqual({ error: DEFAULT_CREDENTIALS_REFUSED });

    process.env.ALLOW_DEFAULT_CREDENTIALS = 'true';
    const allowed = await login({ username: 'admin', password: 'smartchat' });
    expect(allowed.statusCode).toBe(200);
    process.env.DEFAULT_USERNAME = 'tester';
    process.env.DEFAULT_PASSWORD = 'password123';
  });

  it('rate-limits repeated attempts from one address', async () => {
    const ip = nextIp();
    let last = 0;
    for (let i = 0; i <= LOGIN_MAX_ATTEMPTS; i++) {
      last = (await login({ username: 'tester', password: 'wrong-password' }, ip)).statusCode;
    }
    expect(last).toBe(429);
  });

  it('keys the limiter on the socket address unless TRUST_PROXY is set', () => {
    const req = createReq({ ip: '203.0.113.9', headers: { 'x-forwarded-for': '1.2.3.4, 5.6.7.8' } });
    expect(clientIp(req)).toBe('203.0.113.9'); // a spoofed header no longer picks the bucket
    process.env.TRUST_PROXY = 'true';
    expect(clientIp(req)).toBe('1.2.3.4');
  });
});
