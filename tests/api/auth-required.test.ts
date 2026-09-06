import { describe, expect, it, vi } from 'vitest';
import { call, authHeaders } from '../helpers/http';

// Modules that pull provider SDKs are replaced; this file tests the gate, not the work.
vi.mock('@/src/services/llm/AIProviderFactory', () => ({ AIProviderFactory: { createProvider: vi.fn() } }));
vi.mock('@/src/services/rag/fetchDataFromPinecone', () => ({ fetchDataFromPinecone: vi.fn() }));
vi.mock('@/src/services/rag/embedding', () => ({ createEmbedding: vi.fn() }));
vi.mock('@/src/services/rag/ingestDataToPinecone', () => ({ default: vi.fn() }));
vi.mock('@/src/utils/fileHelper/processMessageFile', () => ({
  processImageFiles: vi.fn(() => []),
  processNonMediaFiles: vi.fn(async () => '')
}));
vi.mock('@/src/services/aws/manageRemoteInstance', () => ({ manageEC2Instance: vi.fn() }));
vi.mock('@/src/services/aws/manageRemoteServer', () => ({ manageServer: vi.fn() }));

/**
 * Every route except login and health. chat, upload, screenshot, startserver
 * and stopserver used to accept anonymous requests: model spend, file ingestion,
 * a screenshot of the host, and SSH into a cloud instance, all open.
 */
const ROUTES: Record<string, () => Promise<{ default: unknown }>> = {
  'ai/chat': () => import('@/src/pages/api/ai/chat'),
  'tools/upload': () => import('@/src/pages/api/tools/upload'),
  'tools/screenshot': () => import('@/src/pages/api/tools/screenshot'),
  'tools/startserver': () => import('@/src/pages/api/tools/startserver'),
  'tools/stopserver': () => import('@/src/pages/api/tools/stopserver'),
  aiconfig: () => import('@/src/pages/api/aiconfig'),
  'chats/index': () => import('@/src/pages/api/chats/index'),
  'chats/[chatId]/chat': () => import('@/src/pages/api/chats/[chatId]/chat'),
  'chats/[chatId]/messages': () => import('@/src/pages/api/chats/[chatId]/messages')
};

type Handler = Parameters<typeof call>[0];

describe('authentication is required on every API route except login and health', () => {
  for (const [name, load] of Object.entries(ROUTES)) {
    it(`${name}: 401 without a token`, async () => {
      const handler = (await load()).default as Handler;
      const res = await call(handler, { method: 'POST', body: {}, query: { chatId: '1' } });
      expect(res.statusCode).toBe(401);
      expect(res.body).toEqual({ error: 'Authentication required' });
    });

    it(`${name}: 401 with a token signed by another secret`, async () => {
      const handler = (await load()).default as Handler;
      const { signToken } = await import('../helpers/http');
      const res = await call(handler, {
        method: 'POST',
        body: {},
        query: { chatId: '1' },
        headers: { authorization: `Bearer ${signToken(1, 'someone-elses-secret')}` }
      });
      expect(res.statusCode).toBe(401);
      expect(res.body).toEqual({ error: 'Invalid token' });
    });
  }

  it('a valid token gets past the gate (screenshot: feature off -> 404, not 401)', async () => {
    const handler = (await ROUTES['tools/screenshot']()).default as Handler;
    const res = await call(handler, { method: 'POST', headers: authHeaders(1) });
    expect(res.statusCode).toBe(404);
  });
});
