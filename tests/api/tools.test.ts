import { afterEach, describe, expect, it, vi } from 'vitest';
import { call, authHeaders } from '../helpers/http';

const manageEC2Instance = vi.fn(async (..._args: unknown[]) => undefined);
const manageServer = vi.fn(async (..._args: unknown[]) => ({ message: 'ok' }));
vi.mock('@/src/services/aws/manageRemoteInstance', () => ({
  manageEC2Instance: (...args: unknown[]) => manageEC2Instance(...args)
}));
vi.mock('@/src/services/aws/manageRemoteServer', () => ({
  manageServer: (...args: unknown[]) => manageServer(...args)
}));
vi.mock('@/src/services/rag/ingestDataToPinecone', () => ({ default: vi.fn() }));

import startHandler from '@/src/pages/api/tools/startserver';
import stopHandler from '@/src/pages/api/tools/stopserver';
import screenshotHandler from '@/src/pages/api/tools/screenshot';
import uploadHandler from '@/src/pages/api/tools/upload';
import { validateRemoteRequest } from '@/src/utils/remoteTools';
import { isAllowedUpload, parseIngestFields, MAX_UPLOAD_BYTES } from '@/src/utils/uploadPolicy';

const valid = { instanceId: 'i-0123456789abcdef0', instanceIP: '203.0.113.10', userName: 'ubuntu', appName: 'smartchat-api' };

afterEach(() => {
  vi.clearAllMocks();
  delete process.env.ENABLE_REMOTE_SERVER_TOOLS;
  delete process.env.REMOTE_SERVER_PEM_PATH;
  delete process.env.ENABLE_SCREENSHOT_TOOL;
});

const enableRemote = () => {
  process.env.ENABLE_REMOTE_SERVER_TOOLS = 'true';
  process.env.REMOTE_SERVER_PEM_PATH = '/etc/smartchat/server.pem';
};

describe('validateRemoteRequest', () => {
  it('accepts a well-formed request', () => {
    expect(validateRemoteRequest(valid)).toEqual({ ok: true, value: valid });
    expect(validateRemoteRequest({ ...valid, instanceIP: 'api.example.com' }).ok).toBe(true);
  });

  it.each([
    ['shell metacharacters in appName', { ...valid, appName: 'x; rm -rf /' }],
    ['a command substitution in appName', { ...valid, appName: '$(reboot)' }],
    ['a caller-supplied key path', { ...valid, pemPath: '/etc/passwd' }],
    ['a bad instance id', { ...valid, instanceId: 'i-zzz' }],
    ['a user name with spaces', { ...valid, userName: 'root user' }],
    ['a host with a path', { ...valid, instanceIP: 'evil.com/../x' }],
    ['a non-object body', 'nope']
  ])('rejects %s', (_label: string, input: unknown) => {
    expect(validateRemoteRequest(input).ok).toBe(false);
  });
});

describe('/api/tools/startserver and stopserver', () => {
  it('do not exist unless the feature is switched on', async () => {
    for (const handler of [startHandler, stopHandler]) {
      const res = await call(handler, { method: 'POST', headers: authHeaders(1), body: valid });
      expect(res.statusCode).toBe(404);
    }
    expect(manageEC2Instance).not.toHaveBeenCalled();
  });

  it('validate before touching anything', async () => {
    enableRemote();
    const res = await call(startHandler, { method: 'POST', headers: authHeaders(1), body: { ...valid, appName: 'x; rm -rf /' } });
    expect(res.statusCode).toBe(400);
    expect(manageEC2Instance).not.toHaveBeenCalled();
    expect(manageServer).not.toHaveBeenCalled();
  });

  it('use the key path from the environment, never from the request', async () => {
    enableRemote();
    const res = await call(stopHandler, { method: 'POST', headers: authHeaders(1), body: valid });
    expect(res.statusCode).toBe(200);
    expect(manageEC2Instance).toHaveBeenCalledWith('i-0123456789abcdef0', 'stop');
    expect(manageServer).toHaveBeenCalledWith('203.0.113.10', 'ubuntu', '/etc/smartchat/server.pem', 'smartchat-api', 'stop');
  });

  it('report a failure without leaking it', async () => {
    enableRemote();
    manageEC2Instance.mockRejectedValueOnce(new Error('AccessDenied for AKIA123'));
    const res = await call(startHandler, { method: 'POST', headers: authHeaders(1), body: valid });
    expect(res.statusCode).toBe(502);
    expect(JSON.stringify(res.body)).not.toContain('AKIA');
  });
});

describe('/api/tools/screenshot', () => {
  it('is off by default', async () => {
    const res = await call(screenshotHandler, { method: 'POST', headers: authHeaders(1) });
    expect(res.statusCode).toBe(404);
  });
});

describe('/api/tools/upload', () => {
  it('is unavailable until RAG is configured', async () => {
    const res = await call(uploadHandler, { method: 'POST', headers: authHeaders(1) });
    expect(res.statusCode).toBe(404);
  });

  it('accepts only PDFs', () => {
    expect(isAllowedUpload({ mimetype: 'application/pdf', originalFilename: 'a.pdf' })).toBe(true);
    expect(isAllowedUpload({ mimetype: 'application/pdf', originalFilename: 'a.exe' })).toBe(false);
    expect(isAllowedUpload({ mimetype: 'text/plain', originalFilename: 'a.pdf' })).toBe(false);
    expect(isAllowedUpload({})).toBe(false);
    expect(MAX_UPLOAD_BYTES).toBe(20 * 1024 * 1024);
  });

  it('validates the ingestion fields in both the old JSON shape and plain strings', () => {
    const ok = parseIngestFields({
      chunkSize: ['1000'],
      chunkOverlap: ['100'],
      fileCategory: ['{"value":"Finance","label":"Finance"}'],
      embeddingModel: ['openai']
    });
    expect(ok).toEqual({ ok: true, value: { chunkSize: 1000, chunkOverlap: 100, namespace: 'finance-openai' } });

    expect(parseIngestFields({ chunkSize: '10', chunkOverlap: '0', fileCategory: 'a', embeddingModel: 'b' }).ok).toBe(false);
    expect(parseIngestFields({ chunkSize: '1000', chunkOverlap: '900', fileCategory: 'a', embeddingModel: 'b' }).ok).toBe(false);
    expect(parseIngestFields({ chunkSize: '1000', chunkOverlap: '0', fileCategory: '../x', embeddingModel: 'b' }).ok).toBe(false);
    expect(parseIngestFields(null).ok).toBe(false);
  });
});
