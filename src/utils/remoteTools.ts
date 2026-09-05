/**
 * Validation for the remote-server tools.
 *
 * The start/stop routes took `instanceId`, `instanceIP`, `userName`,
 * `pemPath` and `appName` straight from the request body and, with no
 * authentication, read the private key at `pemPath` from the server's disk
 * and ran `systemctl <action> <appName>` over SSH. Anyone who could reach
 * the port could read files and run commands on the remote host. The key
 * path now comes from the environment; everything else must match a strict
 * shape before it is used.
 */

import { isRecord } from '@/src/middleware/guards';

export const INSTANCE_ID = /^i-[0-9a-f]{8,17}$/;
export const SSH_USER = /^[a-z_][a-z0-9_-]{0,31}$/;
/** A systemd unit name; no shell metacharacters. */
export const UNIT_NAME = /^[A-Za-z0-9@_.-]{1,64}$/;
const IPV4 = /^(25[0-5]|2[0-4]\d|1?\d?\d)(\.(25[0-5]|2[0-4]\d|1?\d?\d)){3}$/;
const HOSTNAME = /^(?=.{1,253}$)([a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/i;

export interface RemoteRequest {
  instanceId: string;
  instanceIP: string;
  userName: string;
  appName: string;
}

export type Validation<T> = { ok: true; value: T } | { ok: false; errors: string[] };

const str = (value: unknown): string => (typeof value === 'string' ? value.trim() : '');

export function validateRemoteRequest(body: unknown): Validation<RemoteRequest> {
  if (!isRecord(body)) return { ok: false, errors: ['Body must be a JSON object'] };
  const errors: string[] = [];
  const instanceId = str(body.instanceId);
  const instanceIP = str(body.instanceIP);
  const userName = str(body.userName);
  const appName = str(body.appName);
  if (!INSTANCE_ID.test(instanceId)) errors.push('instanceId must look like i-0123456789abcdef0');
  if (!IPV4.test(instanceIP) && !HOSTNAME.test(instanceIP)) {
    errors.push('instanceIP must be an IPv4 address or a hostname');
  }
  if (!SSH_USER.test(userName)) errors.push('userName must be a Unix user name');
  if (!UNIT_NAME.test(appName)) errors.push('appName must be a systemd unit name');
  if ('pemPath' in body) errors.push('pemPath is not accepted; the server uses REMOTE_SERVER_PEM_PATH');
  if (errors.length) return { ok: false, errors };
  return { ok: true, value: { instanceId, instanceIP, userName, appName } };
}
