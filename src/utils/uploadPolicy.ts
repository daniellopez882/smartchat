/**
 * What the upload route accepts. The route took any file of any size
 * (formidable's default limit is 200 MB), and the only loader behind it reads
 * PDFs — everything else failed after being written to disk.
 */

import { isRecord } from '@/src/middleware/guards';
import type { Validation } from '@/src/utils/remoteTools';

export const MAX_UPLOAD_BYTES = 20 * 1024 * 1024;
export const ALLOWED_MIME_TYPES = ['application/pdf'];
export const ALLOWED_EXTENSIONS = ['.pdf'];
export const CHUNK_SIZE_RANGE = { min: 100, max: 4000 };
export const NAMESPACE = /^[a-z0-9][a-z0-9-]{0,62}$/;

export interface UploadPart {
  mimetype?: string | null;
  originalFilename?: string | null;
}

export const isAllowedUpload = ({ mimetype, originalFilename }: UploadPart): boolean => {
  const name = (originalFilename ?? '').toLowerCase();
  const extensionOk = ALLOWED_EXTENSIONS.some(ext => name.endsWith(ext));
  const mimeOk = !!mimetype && ALLOWED_MIME_TYPES.includes(mimetype);
  return extensionOk && mimeOk;
};

export const formidableOptions = {
  maxFileSize: MAX_UPLOAD_BYTES,
  maxFiles: 1,
  filter: isAllowedUpload
};

export interface IngestFields {
  chunkSize: number;
  chunkOverlap: number;
  namespace: string;
}

const first = (value: unknown): unknown => (Array.isArray(value) ? value[0] : value);

/** Accepts the old `{"value": "..."}` JSON shape as well as a plain string. */
const optionValue = (raw: unknown): string => {
  const value = first(raw);
  if (typeof value !== 'string') return '';
  try {
    const parsed = JSON.parse(value);
    if (isRecord(parsed) && typeof parsed.value === 'string') return parsed.value;
  } catch {
    /* plain string */
  }
  return value;
};

export function parseIngestFields(fields: unknown): Validation<IngestFields> {
  if (!isRecord(fields)) return { ok: false, errors: ['Missing form fields'] };
  const errors: string[] = [];
  const chunkSize = Number(first(fields.chunkSize));
  const chunkOverlap = Number(first(fields.chunkOverlap));
  if (!Number.isInteger(chunkSize) || chunkSize < CHUNK_SIZE_RANGE.min || chunkSize > CHUNK_SIZE_RANGE.max) {
    errors.push(`chunkSize must be an integer between ${CHUNK_SIZE_RANGE.min} and ${CHUNK_SIZE_RANGE.max}`);
  }
  if (!Number.isInteger(chunkOverlap) || chunkOverlap < 0 || chunkOverlap > chunkSize / 2) {
    errors.push('chunkOverlap must be an integer between 0 and half of chunkSize');
  }
  const category = optionValue(fields.fileCategory).toLowerCase();
  const model = optionValue(fields.embeddingModel).toLowerCase();
  const namespace = `${category}-${model}`;
  if (!category || !model || !NAMESPACE.test(namespace)) {
    errors.push('fileCategory and embeddingModel must be short lowercase identifiers');
  }
  if (errors.length) return { ok: false, errors };
  return { ok: true, value: { chunkSize, chunkOverlap, namespace } };
}
