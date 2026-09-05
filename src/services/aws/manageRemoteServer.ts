import fs from 'fs';
import { Client } from 'ssh2';

import { UNIT_NAME } from '@/src/utils/remoteTools';

export interface RemoteCommand {
  host: string;
  userName: string;
  privateKeyPath: string;
  command: string;
}

// `ssh2` is declared as an untyped module in src/types; this is the slice of
// the exec stream the code uses.
interface ExecStream {
  on(event: 'close', listener: (code: number | null) => void): ExecStream;
  stderr: { on(event: 'data', listener: (data: Buffer) => void): void };
}

const executeCommand = ({ host, userName, privateKeyPath, command }: RemoteCommand) =>
  new Promise<{ message: string }>((resolve, reject) => {
    let privateKey: Buffer;
    try {
      privateKey = fs.readFileSync(privateKeyPath);
    } catch (error) {
      return reject(new Error(`Cannot read the private key: ${(error as Error).message}`));
    }
    const conn = new Client();
    conn
      .on('ready', () => {
        conn.exec(command, (err: Error | undefined, stream: ExecStream) => {
          if (err) {
            conn.end();
            return reject(err);
          }
          stream
            .on('close', (code: number | null) => {
              conn.end();
              if (code === 0) resolve({ message: `Command succeeded: ${command}` });
              else reject(new Error(`Command failed with exit code ${code}`));
            })
            .stderr.on('data', (data: Buffer) => {
              console.error('STDERR: ' + data);
            });
        });
      })
      .on('error', reject)
      .connect({ host, port: 22, username: userName, privateKey });
  });

/**
 * `systemctl start|stop <unit>` over SSH. The unit name must already have
 * passed UNIT_NAME (no shell metacharacters); it is checked again here
 * because this is the last place before the string reaches a shell.
 */
export const manageServer = (
  host: string,
  userName: string,
  privateKeyPath: string,
  appName: string,
  action: 'start' | 'stop'
): Promise<{ message: string }> => {
  if (!UNIT_NAME.test(appName)) {
    return Promise.reject(new Error('Invalid unit name'));
  }
  return executeCommand({
    host,
    userName,
    privateKeyPath,
    command: `systemctl ${action} '${appName}'`
  });
};
