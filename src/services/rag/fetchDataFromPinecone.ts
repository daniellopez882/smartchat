import { requireEnv } from '@/config/env';
import { getPineconeClient } from '@/src/services/rag/pineconeClient';

export const TOP_K = 3;

/**
 * The text of the closest chunks in a namespace, joined; an empty string when
 * nothing matches. It used to throw 'No matches found', which the chat route
 * turned into a 500 — asking a question in an empty namespace failed the
 * whole request instead of answering without context.
 */
export const fetchDataFromPinecone = async (
  embeddedQuery: number[],
  nameSpace: string
): Promise<string> => {
  if (!Array.isArray(embeddedQuery) || embeddedQuery.length === 0) {
    throw new Error('Invalid or empty query vector provided.');
  }

  const index = getPineconeClient().Index(requireEnv('PINECONE_INDEX_NAME'));
  const queryResponse = await index.namespace(nameSpace).query({
    vector: embeddedQuery,
    topK: TOP_K,
    includeValues: false,
    includeMetadata: true
  });

  const matches = queryResponse?.matches ?? [];
  return matches
    .map(match => (typeof match.metadata?.text === 'string' ? match.metadata.text : ''))
    .filter(Boolean)
    .join('\n');
};
