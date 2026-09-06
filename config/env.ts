/**
 * Environment access.
 *
 * Nothing here throws at import. The previous module threw for
 * OPENAI_API_KEY, PINECONE_API_KEY, JWT_SECRET and NEXT_PUBLIC_API_URL the
 * moment anything imported it, so `next build` and every page — the login
 * page included — required every provider to be configured, even for a user
 * who only wanted Gemini or Groq. Required values are checked where they are
 * used (`requireEnv`); optional ones become feature flags.
 */

const read = (name: string): string => (process.env[name] ?? '').trim();
const flag = (name: string): boolean => read(name).toLowerCase() === 'true';

export class MissingEnvError extends Error {
  constructor(public readonly name: string) {
    super(`${name} is not set`);
  }
}

/** Read a required variable at the point of use, not at import. */
export const requireEnv = (name: string): string => {
  const value = read(name);
  if (!value) throw new MissingEnvError(name);
  return value;
};

/** Live getters, so tests can change the environment after import. */
export const env = {
  get OPENAI_API_KEY() {
    return read('OPENAI_API_KEY');
  },
  get GEMINI_API_KEY() {
    return read('GEMINI_API_KEY');
  },
  get CLAUDE_API_KEY() {
    return read('CLAUDE_API_KEY');
  },
  get GROQ_API_KEY() {
    return read('GROQ_API_KEY');
  },
  get PINECONE_API_KEY() {
    return read('PINECONE_API_KEY');
  },
  get PINECONE_INDEX_NAME() {
    return read('PINECONE_INDEX_NAME');
  },
  get JWT_SECRET() {
    return read('JWT_SECRET');
  },
  get DEFAULT_USERNAME() {
    return read('DEFAULT_USERNAME');
  },
  get DEFAULT_PASSWORD() {
    return read('DEFAULT_PASSWORD');
  },
  get DATABASE_PATH() {
    return read('DATABASE_PATH') || 'database.sqlite';
  },
  get NEXT_PUBLIC_API_URL() {
    return read('NEXT_PUBLIC_API_URL');
  },
  get NEXT_PUBLIC_SERVER_URL() {
    return read('NEXT_PUBLIC_SERVER_URL');
  },
  get NEXT_PUBLIC_SERVER_GPU_URL() {
    return read('NEXT_PUBLIC_SERVER_GPU_URL');
  },
  get NEXT_PUBLIC_SERVER_SECRET_KEY() {
    return read('NEXT_PUBLIC_SERVER_SECRET_KEY');
  },
  /** Private key for the remote-server tools. It was taken from the request body. */
  get REMOTE_SERVER_PEM_PATH() {
    return read('REMOTE_SERVER_PEM_PATH');
  }
};

export const features = {
  /** Uploads and retrieval need Pinecone and OpenAI embeddings. */
  get rag() {
    return !!(env.PINECONE_API_KEY && env.PINECONE_INDEX_NAME && env.OPENAI_API_KEY);
  },
  /** Captures the server's own desktop; only meaningful on a personal machine. Off by default. */
  get screenshot() {
    return flag('ENABLE_SCREENSHOT_TOOL');
  },
  /** Starts/stops an EC2 instance and SSHes into it. Off by default. */
  get remoteTools() {
    return flag('ENABLE_REMOTE_SERVER_TOOLS') && !!env.REMOTE_SERVER_PEM_PATH;
  },
  /** Trust X-Forwarded-For for rate limiting; only behind a proxy you control. */
  get trustProxy() {
    return flag('TRUST_PROXY');
  },
  get allowDefaultCredentials() {
    return flag('ALLOW_DEFAULT_CREDENTIALS');
  },
  get isProduction() {
    return read('NODE_ENV') === 'production';
  }
};

// Kept for the client bundle, which reads it at build time.
export const NEXT_PUBLIC_API_URL = env.NEXT_PUBLIC_API_URL;
