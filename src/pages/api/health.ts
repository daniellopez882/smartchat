import type { NextApiRequest, NextApiResponse } from 'next';

import { features } from '@/config/env';
import { getAppDataSource } from '@/src/db';
import { withMethods } from '@/src/middleware/guards';

/** Liveness plus which optional features this server has enabled. No secrets. */
const handler = withMethods(['GET'], async (_req: NextApiRequest, res: NextApiResponse) => {
  let database: 'ok' | 'error' = 'ok';
  try {
    await (await getAppDataSource()).query('SELECT 1');
  } catch (error) {
    console.error('Health check: database error', error);
    database = 'error';
  }
  return res.status(database === 'ok' ? 200 : 503).json({
    status: database === 'ok' ? 'ok' : 'degraded',
    database,
    features: {
      rag: features.rag,
      screenshot: features.screenshot,
      remoteTools: features.remoteTools
    }
  });
});

export default handler;
