import 'reflect-metadata';
import type { NextApiRequest, NextApiResponse } from 'next';
import { DataSource } from 'typeorm';

import { getAppDataSource, Chat, ChatMessage, ChatFile } from '@/src/db';
import { withAuth } from '@/src/middleware/auth';

/**
 * Delete or rename one chat. Both used to look the chat up by id alone; any
 * authenticated user could delete or rename any other user's chat. The
 * lookups include the caller's userId now.
 */
const handleDeleteRequest = async (
  res: NextApiResponse,
  dataSource: DataSource,
  chatId: number,
  userId: number
) => {
  const deleted = await dataSource.transaction(async manager => {
    const chat = await manager.findOne(Chat, {
      where: { id: chatId, userId },
      relations: ['messages']
    });
    if (!chat) return false;
    for (const message of chat.messages ?? []) {
      await manager.delete(ChatFile, { messageId: message.id });
    }
    await manager.delete(ChatMessage, { chatId: chat.id });
    await manager.delete(Chat, { id: chat.id });
    return true;
  });
  if (!deleted) return res.status(404).json({ error: 'Chat not found' });
  return res.status(200).json({ message: 'Chat and all associated data deleted successfully' });
};

const handlePutRequest = async (
  req: NextApiRequest,
  res: NextApiResponse,
  dataSource: DataSource,
  chatId: number,
  userId: number
) => {
  const { title, tags } = (req.body ?? {}) as { title?: unknown; tags?: unknown };
  const chats = dataSource.getRepository(Chat);
  const chat = await chats.findOne({ where: { id: chatId, userId } });
  if (!chat) return res.status(404).json({ error: 'Chat not found' });

  let isUpdated = false;
  if (title !== undefined) {
    if (typeof title !== 'string' || title.length < 1 || title.length > 255) {
      return res.status(400).json({ error: 'Title must be a string between 1 and 255 characters' });
    }
    chat.title = title;
    isUpdated = true;
  }
  if (tags !== undefined) {
    if (!Array.isArray(tags) || !tags.every(tag => typeof tag === 'string')) {
      return res.status(400).json({ error: 'Tags must be an array of strings' });
    }
    chat.tags = tags;
    isUpdated = true;
  }
  if (!isUpdated) return res.status(400).json({ error: 'Title or tags must be provided' });

  await chats.save(chat);
  return res.status(200).json({ message: 'Chat updated successfully' });
};

const handler = withAuth(async (req: NextApiRequest, res: NextApiResponse, userId: number) => {
  const chatId = Number(req.query.chatId);
  if (!Number.isInteger(chatId) || chatId <= 0) {
    return res.status(400).json({ error: 'Invalid chat ID' });
  }
  try {
    const dataSource = await getAppDataSource();
    switch (req.method) {
      case 'DELETE':
        return await handleDeleteRequest(res, dataSource, chatId, userId);
      case 'PUT':
        return await handlePutRequest(req, res, dataSource, chatId, userId);
      default:
        res.setHeader('Allow', ['DELETE', 'PUT']);
        return res.status(405).json({ error: `Method ${req.method} not allowed` });
    }
  } catch (error) {
    console.error('Error during chat operation', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default handler;
