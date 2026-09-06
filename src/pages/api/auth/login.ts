import type { NextApiRequest, NextApiResponse } from 'next';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

import { env, features } from '@/config/env';
import { getAppDataSource, User } from '@/src/db';
import { applyLoginLimiter, validateLogin } from '@/src/middleware/auth';
import { withMethods } from '@/src/middleware/guards';

export const TOKEN_TTL = '12h';
export const DEFAULT_CREDENTIALS_REFUSED =
  'Default credentials are refused in production; set DEFAULT_USERNAME/DEFAULT_PASSWORD or ALLOW_DEFAULT_CREDENTIALS=true';

/** True when the configured first-user credentials are the ones shipped in .env.example. */
export const usingShippedDefaults = () =>
  env.DEFAULT_USERNAME === 'admin' && env.DEFAULT_PASSWORD === 'smartchat';

const handler = withMethods(['POST'], async (req: NextApiRequest, res: NextApiResponse) => {
  if (!(await applyLoginLimiter(req, res))) return;

  const errors = await validateLogin(req);
  if (errors.length) {
    return res.status(400).json({ error: 'Invalid input', details: errors });
  }
  const { username, password } = req.body as { username: string; password: string };

  if (!env.JWT_SECRET) {
    console.error('JWT_SECRET is not set');
    return res.status(500).json({ error: 'Server is not configured' });
  }

  try {
    const dataSource = await getAppDataSource();
    const users = dataSource.getRepository(User);
    let user = await users.findOne({ where: { username } });

    // This app is for one person: the first login with the configured default
    // credentials creates the only user. The .env.example pair (admin/smartchat)
    // is refused in production unless explicitly allowed.
    if (!user) {
      const isDefault = username === env.DEFAULT_USERNAME && password === env.DEFAULT_PASSWORD;
      if (!isDefault) return res.status(401).json({ error: 'Invalid login credentials' });
      if (features.isProduction && usingShippedDefaults() && !features.allowDefaultCredentials) {
        console.error(DEFAULT_CREDENTIALS_REFUSED);
        return res.status(403).json({ error: DEFAULT_CREDENTIALS_REFUSED });
      }
      user = users.create({ username, password: await bcrypt.hash(password, 10) });
      await users.save(user);
    }

    if (!(await bcrypt.compare(password, user.password))) {
      return res.status(401).json({ error: 'Invalid login credentials' });
    }

    const token = jwt.sign({ userId: user.id }, env.JWT_SECRET, { expiresIn: TOKEN_TTL });
    return res.status(200).json({ message: 'Login successful', token });
  } catch (error) {
    console.error('Login error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default handler;
