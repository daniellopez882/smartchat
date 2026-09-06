import { OpenAIEmbeddings } from '@langchain/openai';
import { PineconeStore } from '@langchain/pinecone';

import { requireEnv } from '@/config/env';
import {
  getPineconeClient,
  checkIndexExists,
  createPineconeIndex
} from '@/src/services/rag/pineconeClient';
import loadAndSplit from '@/src/services/rag/pdfLoadAndSplit';

/** Chunks a PDF, embeds the chunks and upserts them; returns the chunk count. */
const ingestDataToPinecone = async (
  filePath: string,
  namespace: string,
  indexName: string,
  chunkSize: number,
  chunkOverlap: number
): Promise<number> => {
  const chunks = await loadAndSplit(filePath, chunkSize, chunkOverlap);
  if (chunks.length === 0) {
    throw new Error('No text could be extracted from the document.');
  }

  const pinecone = getPineconeClient();
  if (!(await checkIndexExists(indexName))) {
    await createPineconeIndex(pinecone, indexName);
  }

  const embeddings = new OpenAIEmbeddings({ apiKey: requireEnv('OPENAI_API_KEY') });
  await PineconeStore.fromDocuments(chunks, embeddings, {
    pineconeIndex: pinecone.Index(indexName),
    namespace,
    textKey: 'text'
  });
  return chunks.length;
};

export default ingestDataToPinecone;
