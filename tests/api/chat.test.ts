import { afterEach, describe, expect, it, vi } from 'vitest';
import { call, authHeaders } from '../helpers/http';

const createProvider = vi.fn();
const fetchDataFromPinecone = vi.fn();
const createEmbedding = vi.fn();
vi.mock('@/src/services/llm/AIProviderFactory', () => ({
  AIProviderFactory: { createProvider: (...args: unknown[]) => createProvider(...args) }
}));
vi.mock('@/src/services/rag/fetchDataFromPinecone', () => ({
  fetchDataFromPinecone: (...args: unknown[]) => fetchDataFromPinecone(...args)
}));
vi.mock('@/src/services/rag/embedding', () => ({
  createEmbedding: (...args: unknown[]) => createEmbedding(...args)
}));
vi.mock('@/src/utils/fileHelper/processMessageFile', () => ({
  processImageFiles: () => [],
  processNonMediaFiles: async () => ''
}));

import handler, { parseChatRequest, MAX_QUESTION_CHARS } from '@/src/pages/api/ai/chat';
import { BadRequestError } from '@/src/middleware/guards';

const assistant = (category: string, value = 'model-x') => ({
  value: 'a',
  label: 'A',
  isDefault: true,
  config: { name: 'A', role: 'r', model: { value, label: value, category }, basePrompt: '', temperature: 0.7, topP: 0.7 }
});

const body = (overrides: Record<string, unknown> = {}) => ({
  question: 'What is up?',
  fileSrc: [],
  chatHistory: [],
  namespace: 'none',
  selectedAssistant: assistant('openai'),
  ...overrides
});

afterEach(() => {
  vi.clearAllMocks();
  delete process.env.OPENAI_API_KEY;
  delete process.env.PINECONE_API_KEY;
  delete process.env.PINECONE_INDEX_NAME;
});

describe('parseChatRequest', () => {
  it('accepts a minimal request and defaults the optional arrays', () => {
    const parsed = parseChatRequest({ question: 'hi', selectedAssistant: assistant('groq') });
    expect(parsed.fileSrc).toEqual([]);
    expect(parsed.chatHistory).toEqual([]);
    expect(parsed.namespace).toBeNull();
    expect(parsed.category).toBe('groq');
  });

  it.each([
    [undefined, /JSON object/],
    [body({ question: '', fileSrc: [] }), /No question/],
    [body({ fileSrc: 'nope' }), /fileSrc/],
    [body({ fileSrc: [{ type: 'text/plain' }] }), /fileSrc/],
    [body({ chatHistory: [{ question: 1 }] }), /chatHistory/],
    [body({ question: 'x'.repeat(MAX_QUESTION_CHARS + 1) }), /at most/],
    [body({ selectedAssistant: {} }), /Model name/],
    [body({ selectedAssistant: assistant('bitcoin') }), /category/],
    [body({ namespace: '../etc' }), /namespace/]
  ])('rejects %o', (input: unknown, message: RegExp) => {
    expect(() => parseChatRequest(input)).toThrow(BadRequestError);
    expect(() => parseChatRequest(input)).toThrow(message);
  });
});

describe('POST /api/ai/chat', () => {
  it('400 on a bad body instead of a crash', async () => {
    // The old handler read `fileSrc.length` before checking it existed.
    const res = await call(handler, { method: 'POST', headers: authHeaders(1), body: { selectedAssistant: assistant('openai') } });
    expect(res.statusCode).toBe(400);
    expect(res.body).toEqual({ error: 'No question in the request' });
  });

  it('503 when the provider for the chosen model is not configured', async () => {
    const res = await call(handler, { method: 'POST', headers: authHeaders(1), body: body() });
    expect(res.statusCode).toBe(503);
    expect(createProvider).not.toHaveBeenCalled();
  });

  it('answers, and splits the subject tag out of the reply', async () => {
    process.env.OPENAI_API_KEY = 'sk-test';
    createProvider.mockReturnValue({ getChatCompletion: vi.fn(async () => 'Not much. {{{Greeting}}}') });
    const res = await call(handler, { method: 'POST', headers: authHeaders(1), body: body() });
    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ answer: 'Not much.', subject: 'Greeting' });
    expect(createProvider).toHaveBeenCalledWith('openai', 'sk-test', undefined);
    expect(fetchDataFromPinecone).not.toHaveBeenCalled();
  });

  it('400 when a namespace is requested but RAG is not configured', async () => {
    process.env.GROQ_API_KEY = 'g';
    const res = await call(handler, { method: 'POST', headers: authHeaders(1), body: body({ namespace: 'docs', selectedAssistant: assistant('groq') }) });
    expect(res.statusCode).toBe(400);
    expect(res.body).toEqual({ error: 'Retrieval (RAG) is not enabled on this server' });
    delete process.env.GROQ_API_KEY;
  });

  it('an empty retrieval result no longer fails the request', async () => {
    process.env.OPENAI_API_KEY = 'sk-test';
    process.env.PINECONE_API_KEY = 'pc';
    process.env.PINECONE_INDEX_NAME = 'idx';
    createEmbedding.mockResolvedValue([0.1, 0.2]);
    fetchDataFromPinecone.mockResolvedValue(''); // used to throw 'No matches found' -> 500
    const completion = vi.fn(async (..._args: unknown[]) => 'Answer without context {{{Topic}}}');
    createProvider.mockReturnValue({ getChatCompletion: completion });
    const res = await call(handler, { method: 'POST', headers: authHeaders(1), body: body({ namespace: 'docs' }) });
    expect(res.statusCode).toBe(200);
    expect(fetchDataFromPinecone).toHaveBeenCalledWith([0.1, 0.2], 'docs');
    expect(completion.mock.calls[0][2]).toBe(''); // fetchedText
  });

  it('502 with a generic message when the provider fails', async () => {
    process.env.OPENAI_API_KEY = 'sk-test';
    createProvider.mockReturnValue({
      getChatCompletion: vi.fn(async () => {
        throw new Error('rate limited: key sk-live-123');
      })
    });
    const res = await call(handler, { method: 'POST', headers: authHeaders(1), body: body() });
    expect(res.statusCode).toBe(502);
    expect(JSON.stringify(res.body)).not.toContain('sk-live');
  });
});
