import type { NextApiRequest, NextApiResponse } from 'next';
import formidable from 'formidable';
import fs from 'fs';

import { features, requireEnv } from '@/config/env';
import { withAuth } from '@/src/middleware/auth';
import { requireFeature, withMethods } from '@/src/middleware/guards';
import ingestDataToPinecone from '@/src/services/rag/ingestDataToPinecone';
import { MAX_UPLOAD_BYTES, formidableOptions, parseIngestFields } from '@/src/utils/uploadPolicy';

export const config = {
  api: { bodyParser: false } // formidable reads the stream
};

type Parsed = { fields: formidable.Fields; files: formidable.Files };

const parseForm = (req: NextApiRequest): Promise<Parsed> =>
  new Promise((resolve, reject) => {
    formidable(formidableOptions).parse(req, (err, fields, files) => {
      if (err) return reject(err);
      resolve({ fields, files });
    });
  });

/**
 * Ingests a PDF into Pinecone. Was: unauthenticated, any file type, any size,
 * fields parsed with JSON.parse straight from the form, temp file leaked on
 * error. Now: token required, RAG must be configured, PDF only, 20 MB cap,
 * fields validated, temp file always removed.
 */
const handler = withAuth(
  withMethods(
    ['POST'],
    requireFeature(
      () => features.rag,
      'Document upload (RAG)',
      async (req: NextApiRequest, res: NextApiResponse) => {
        let filepath: string | undefined;
        try {
          const { fields, files } = await parseForm(req);
          const uploaded = files.file?.[0];
          if (!uploaded) {
            return res.status(400).json({
              error: `Only PDF files up to ${MAX_UPLOAD_BYTES / 1024 / 1024} MB are accepted`
            });
          }
          filepath = uploaded.filepath;
          const parsed = parseIngestFields(fields);
          if (!parsed.ok) {
            return res.status(400).json({ error: 'Invalid form fields', details: parsed.errors });
          }
          const { chunkSize, chunkOverlap, namespace } = parsed.value;
          const chunks = await ingestDataToPinecone(
            filepath,
            namespace,
            requireEnv('PINECONE_INDEX_NAME'),
            chunkSize,
            chunkOverlap
          );
          return res.status(200).json({
            message: 'File uploaded successfully.',
            fileName: uploaded.originalFilename,
            chunks
          });
        } catch (error) {
          const code = (error as { code?: number }).code;
          if (code === 1009) {
            // formidable: maxFileSize exceeded
            return res.status(413).json({ error: `File is larger than ${MAX_UPLOAD_BYTES / 1024 / 1024} MB` });
          }
          console.error('Upload failed:', error);
          return res.status(500).json({ error: 'Failed to upload file.' });
        } finally {
          if (filepath) await fs.promises.unlink(filepath).catch(() => undefined);
        }
      }
    )
  )
);

export default handler;
