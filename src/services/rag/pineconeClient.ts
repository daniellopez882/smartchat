import { Pinecone, IndexStatsNamespaceSummary, IndexModel } from '@pinecone-database/pinecone';

import { requireEnv } from '@/config/env';

let client: Pinecone | null = null;

/**
 * Lazily built. The previous module created the client in a top-level
 * `await` at import, so any file that touched it required a Pinecone key
 * before the app could start — including the chat route for users with no
 * RAG at all.
 */
export const getPineconeClient = (): Pinecone => {
  if (!client) {
    client = new Pinecone({ apiKey: requireEnv('PINECONE_API_KEY') });
  }
  return client;
};

/** For tests. */
export const resetPineconeClient = (replacement: Pinecone | null = null) => {
  client = replacement;
};

export const createPineconeIndex = async (pinecone: Pinecone, indexName: string) => {
  console.log(`Creating index ${indexName}...`);
  await pinecone.createIndex({
    name: indexName,
    dimension: 1536,
    metric: 'cosine',
    spec: { serverless: { cloud: 'aws', region: 'us-east-1' } }
  });
};

export const listIndexes = async (): Promise<IndexModel[] | undefined> => {
  try {
    const indexes = await getPineconeClient().listIndexes();
    return indexes.indexes;
  } catch (error) {
    console.error(`An error occurred when listing index: ${error}`);
    return undefined;
  }
};

export const checkIndexExists = async (indexName: string): Promise<boolean> => {
  try {
    const response = await getPineconeClient().describeIndex(indexName);
    return response?.status?.state === 'Ready';
  } catch (error) {
    console.error(`Failed to check if index exists: ${error}`);
    return false;
  }
};

export const getNamespaces = async (indexName: string): Promise<string[] | undefined> => {
  try {
    const index = getPineconeClient().Index(indexName);
    const res = await index.describeIndexStats();
    const namespaces: { [key: string]: IndexStatsNamespaceSummary } | undefined = res.namespaces;
    return namespaces ? Object.keys(namespaces) : undefined;
  } catch (error) {
    console.error(`An error occurred when fetching namespaces: ${error}`);
    return undefined;
  }
};
