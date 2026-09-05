import { beforeAll, describe, expect, it } from 'vitest';
import { call, authHeaders } from './helpers/http';
import { createDataSource, setAppDataSource, Chat, User } from '@/src/db';
import chatHandler from '@/src/pages/api/chats/[chatId]/chat';
import messagesHandler from '@/src/pages/api/chats/[chatId]/messages';
import listHandler from '@/src/pages/api/chats/index';

let chatOfAlice = 0;

beforeAll(async () => {
  const ds = await createDataSource({ database: ':memory:' });
  setAppDataSource(ds);
  const users = ds.getRepository(User);
  await users.save([users.create({ username: 'alice', password: 'x' }), users.create({ username: 'bob', password: 'x' })]);
  const chat = await ds.getRepository(Chat).save(ds.getRepository(Chat).create({ title: "Alice's chat", userId: 1 }));
  chatOfAlice = chat.id;
});

describe('schema', () => {
  it('a fresh database gets its tables from the migration', async () => {
    // With synchronize off and a migrations glob pointing at a missing directory,
    // a fresh clone had no tables: the first login failed with "no such table: users".
    const ds = await createDataSource({ database: ':memory:' });
    const rows: { name: string }[] = await ds.query(
      "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name"
    );
    expect(rows.map(r => r.name)).toEqual(['ai_configs', 'chat_files', 'chat_messages', 'chats', 'migrations', 'users']);
    await ds.destroy();
  });
});

describe('chats belong to their owner', () => {
  it('lists only the caller’s chats', async () => {
    const alice = await call(listHandler, { method: 'GET', headers: authHeaders(1) });
    const bob = await call(listHandler, { method: 'GET', headers: authHeaders(2) });
    expect((alice.body as unknown[]).length).toBe(1);
    expect((bob.body as unknown[]).length).toBe(0);
  });

  it('another user cannot rename, read or delete it', async () => {
    const q = { chatId: String(chatOfAlice) };
    const rename = await call(chatHandler, { method: 'PUT', headers: authHeaders(2), query: q, body: { title: 'stolen' } });
    expect(rename.statusCode).toBe(404);
    const read = await call(messagesHandler, { method: 'GET', headers: authHeaders(2), query: q });
    expect(read.statusCode).toBe(404);
    const append = await call(messagesHandler, {
      method: 'POST',
      headers: authHeaders(2),
      query: q,
      body: { userMessage: 'u', aiMessage: 'a', assistant: 'x' }
    });
    expect(append.statusCode).toBe(404);
    const del = await call(chatHandler, { method: 'DELETE', headers: authHeaders(2), query: q });
    expect(del.statusCode).toBe(404);
  });

  it('the owner can', async () => {
    const q = { chatId: String(chatOfAlice) };
    const rename = await call(chatHandler, { method: 'PUT', headers: authHeaders(1), query: q, body: { title: 'Renamed' } });
    expect(rename.statusCode).toBe(200);
    const append = await call(messagesHandler, {
      method: 'POST',
      headers: authHeaders(1),
      query: q,
      body: { userMessage: 'u', aiMessage: 'a', assistant: 'x', fileSrc: [{ type: 'text/plain', name: 'n', size: 1, base64Content: '' }] }
    });
    expect(append.statusCode).toBe(201);
    const read = await call(messagesHandler, { method: 'GET', headers: authHeaders(1), query: q });
    expect(read.statusCode).toBe(200);
    expect((read.body as { files: unknown[] }[])[0].files).toHaveLength(1);
    const del = await call(chatHandler, { method: 'DELETE', headers: authHeaders(1), query: q });
    expect(del.statusCode).toBe(200);
  });

  it('rejects a non-numeric id', async () => {
    const res = await call(chatHandler, { method: 'DELETE', headers: authHeaders(1), query: { chatId: 'abc' } });
    expect(res.statusCode).toBe(400);
  });
});
