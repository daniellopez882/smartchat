import { OpenAI } from 'openai';

import { requireEnv } from '@/config/env';

export const EMBEDDING_MODEL = 'text-embedding-ada-002';

let client: OpenAI | null = null;

/** Lazily built; the old module constructed the client at import. */
export const getOpenAIClient = (): OpenAI => {
  if (!client) client = new OpenAI({ apiKey: requireEnv('OPENAI_API_KEY') });
  return client;
};

/** For tests. */
export const resetOpenAIClient = (replacement: OpenAI | null = null) => {
  client = replacement;
};

export const createEmbedding = async (text: string): Promise<number[]> => {
  const embedding = await getOpenAIClient().embeddings.create({
    model: EMBEDDING_MODEL,
    input: text
  });
  return embedding.data[0].embedding;
};
