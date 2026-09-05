import type { NextApiRequest, NextApiResponse } from 'next';

import { features } from '@/config/env';
import { withAuth } from '@/src/middleware/auth';
import { requireFeature, withMethods } from '@/src/middleware/guards';

export const SCREENSHOT_WIDTH = 1024;

/**
 * Captures the desktop of the machine running this server and returns it as
 * a data URL. It was unauthenticated: anyone who could reach the port could
 * look at the host's screen. Now: token required, and the route does not
 * exist unless ENABLE_SCREENSHOT_TOOL=true — it only makes sense on a
 * personal machine, never in a container.
 */
const handler = withAuth(
  withMethods(
    ['POST'],
    requireFeature(
      () => features.screenshot,
      'The screenshot tool',
      async (_req: NextApiRequest, res: NextApiResponse) => {
        try {
          // Imported here so a server without the tool never loads the native helper.
          const [{ default: screenshot }, { default: Jimp }] = await Promise.all([
            import('screenshot-desktop'),
            import('jimp')
          ]);
          const image = await Jimp.read(await screenshot());
          image.resize(SCREENSHOT_WIDTH, Jimp.AUTO);
          const pngBuffer = await image.getBufferAsync(Jimp.MIME_PNG);
          return res.status(200).json({
            message: 'Screenshot captured and processed',
            base64Image: `data:image/png;base64,${pngBuffer.toString('base64')}`,
            size: pngBuffer.length,
            name: `screenshot_${Date.now()}.png`,
            type: 'image/png'
          });
        } catch (error) {
          console.error('Error capturing or processing screen:', error);
          return res.status(500).json({ error: 'Error capturing or processing screen' });
        }
      }
    )
  )
);

export default handler;

export const config = {
  api: { bodyParser: { sizeLimit: '20mb' } }
};
