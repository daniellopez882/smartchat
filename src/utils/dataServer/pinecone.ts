import { getNamespaces } from '@/src/services/rag/pineconeClient';
import { features, env } from '@/config/env';

export const fetchNamespaces = async () => {
  try {
    // No Pinecone configured: the UI simply has no namespaces to offer.
    if (!features.rag) return [];
    const namespaces = await getNamespaces(env.PINECONE_INDEX_NAME);

    return namespaces;
  } catch (error) {
    console.error(`Error fetching namespaces:`, error);
    return [];
  }
};
