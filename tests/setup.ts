import 'reflect-metadata';

/** @types/node types NODE_ENV as read-only; tests still need to set it. */
export const setNodeEnv = (value: string) => {
  (process.env as Record<string, string | undefined>).NODE_ENV = value;
};

// A complete, fake configuration; no provider is reachable from the tests.
setNodeEnv('test');
process.env.JWT_SECRET = 'test-secret-that-is-long-enough';
process.env.DATABASE_PATH = ':memory:';
process.env.DEFAULT_USERNAME = 'tester';
process.env.DEFAULT_PASSWORD = 'password123';
process.env.NEXT_PUBLIC_API_URL = 'http://localhost:3000';
delete process.env.OPENAI_API_KEY;
delete process.env.PINECONE_API_KEY;
delete process.env.PINECONE_INDEX_NAME;
delete process.env.ENABLE_SCREENSHOT_TOOL;
delete process.env.ENABLE_REMOTE_SERVER_TOOLS;
delete process.env.REMOTE_SERVER_PEM_PATH;
delete process.env.TRUST_PROXY;
