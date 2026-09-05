import type { NextApiRequest, NextApiResponse } from 'next';

import { env, features } from '@/config/env';
import { withAuth } from '@/src/middleware/auth';
import { requireFeature, withMethods } from '@/src/middleware/guards';
import { manageEC2Instance } from '@/src/services/aws/manageRemoteInstance';
import { manageServer } from '@/src/services/aws/manageRemoteServer';
import { validateRemoteRequest } from '@/src/utils/remoteTools';

/**
 * One handler for /api/tools/startserver and /api/tools/stopserver.
 * Authenticated, behind ENABLE_REMOTE_SERVER_TOOLS, input validated, and the
 * private key path comes from REMOTE_SERVER_PEM_PATH rather than the caller.
 */
export const serverToolHandler = (action: 'start' | 'stop') =>
  withAuth(
    withMethods(
      ['POST'],
      requireFeature(
        () => features.remoteTools,
        'The remote server tool',
        async (req: NextApiRequest, res: NextApiResponse) => {
          const parsed = validateRemoteRequest(req.body);
          if (!parsed.ok) {
            return res.status(400).json({ error: 'Invalid request', details: parsed.errors });
          }
          const { instanceId, instanceIP, userName, appName } = parsed.value;
          try {
            await manageEC2Instance(instanceId, action);
            const serverResponse = await manageServer(
              instanceIP,
              userName,
              env.REMOTE_SERVER_PEM_PATH,
              appName,
              action
            );
            return res.status(200).json({ message: `Instance and app ${action}ed`, serverResponse });
          } catch (error) {
            console.error(`Remote server ${action} failed:`, error);
            return res.status(502).json({ error: `Could not ${action} the remote server` });
          }
        }
      )
    )
  );
