import { describe, expect, it } from 'vitest';
import { joinBrokenSentence } from '@/src/services/rag/pdfLoadAndSplit';
import { fetchDataFromPinecone } from '@/src/services/rag/fetchDataFromPinecone';
import { resetPineconeClient } from '@/src/services/rag/pineconeClient';

describe('joinBrokenSentence', () => {
  it('re-joins words hyphenated across lines', () => {
    expect(joinBrokenSentence('inter-\nnational trade')).toBe('international trade');
  });

  it('keeps a sentence end at a line break and joins a mid-sentence break', () => {
    expect(joinBrokenSentence('It ended here.\nA new one starts')).toBe('It ended here.\nA new one starts');
    expect(joinBrokenSentence('the quick brown\nfox jumps')).toBe('the quick brown fox jumps');
  });

  it('keeps a question and its answer together (a "?" is deliberately not a boundary)', () => {
    expect(joinBrokenSentence('Is it ready?\nyes it is')).toBe('Is it ready? yes it is');
  });
});

describe('fetchDataFromPinecone', () => {
  it('rejects an empty query vector', async () => {
    await expect(fetchDataFromPinecone([], 'ns')).rejects.toThrow(/Invalid or empty/);
  });

  it('returns an empty string when nothing matches, and joins the text of matches', async () => {
    process.env.PINECONE_INDEX_NAME = 'idx';
    const calls: unknown[] = [];
    const fake = {
      Index: () => ({
        namespace: (ns: string) => ({
          query: async (q: unknown) => {
            calls.push([ns, q]);
            return ns === 'empty'
              ? { matches: [] }
              : { matches: [{ metadata: { text: 'alpha' } }, { metadata: {} }, { metadata: { text: 'beta' } }] };
          }
        })
      })
    };
    resetPineconeClient(fake as never);
    expect(await fetchDataFromPinecone([0.1], 'empty')).toBe(''); // used to throw 'No matches found'
    expect(await fetchDataFromPinecone([0.1], 'docs')).toBe('alpha\nbeta');
    expect(calls[1]).toEqual(['docs', { vector: [0.1], topK: 3, includeValues: false, includeMetadata: true }]);
    resetPineconeClient(null);
    delete process.env.PINECONE_INDEX_NAME;
  });
});
