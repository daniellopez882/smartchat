/**
 * PDF -> cleaned text -> chunks.
 *
 * Works on PDFs with a text layer; scanned documents need OCR first. The
 * loader appends a newline after every line, which rarely coincides with the
 * end of a sentence, so `joinBrokenSentence` repairs the most common breaks
 * before splitting. Tabular PDFs are out of scope.
 *
 * Imports come from the split `@langchain/*` packages; `langchain@0.0.96`
 * (mid-2023) was pinned and carried an `axios` with a dozen advisories.
 */
import { PDFLoader } from '@langchain/community/document_loaders/fs/pdf';
import { RecursiveCharacterTextSplitter } from '@langchain/textsplitters';
import type { Document } from '@langchain/core/documents';

export type { Document };

export const joinBrokenSentence = (pageContent: string): string => {
  // Words hyphenated across lines, and hyphens at line starts.
  let text = pageContent.replace(/-\n/g, '').replace(/\n-/g, '-');
  // Newlines that are part of numbered or bulleted lists.
  text = text.replace(/(?<=^\b[0-9a-zA-Z]{1}\.|•)\n/gm, ' ');
  // Newlines that are unlikely to be sentence boundaries: no terminal
  // punctuation before, no sentence-starting capital after. '?' is left
  // alone so an answer is not glued to its question.
  text = text.replace(/(?<![.!] *\)*|[.!]") *\n(?= *[a-z0-9!?:;,.@%&$ ])/g, ' ');
  return text;
};

const loadAndSplit = async (
  docPath: string,
  chunkSize: number,
  chunkOverlap: number
): Promise<Document[]> => {
  const loader = new PDFLoader(docPath, { splitPages: false });
  const [document] = await loader.load();
  if (!document) throw new Error('The PDF produced no text.');

  const splitter = new RecursiveCharacterTextSplitter({
    chunkSize,
    chunkOverlap,
    keepSeparator: true,
    // Prefer breaks that look like sentence ends; fall back to any whitespace.
    separators: ['\n\n', '(?<![.!] *)*|[.!]")\n', '\n(?![?)}]|])', '(?<![.!] *|[.!]"|[.!] *) ', ' ', '']
  });

  return splitter.createDocuments([joinBrokenSentence(document.pageContent)], [document.metadata]);
};

export default loadAndSplit;
