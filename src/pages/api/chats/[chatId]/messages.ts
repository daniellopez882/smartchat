import type { NextApiRequest, NextApiResponse } from 'next';

import { getAppDataSource, Chat, ChatMessage, ChatFile } from '@/src/db';
import { withAuth } from '@/src/middleware/auth';
import { isRecord } from '@/src/middleware/guards';

/**
 * Messages of one chat. The chat must belong to the caller: the old handler
 * ignored the user id entirely, so any token could read or append to any chat.
 */
const handler = withAuth(async (req: NextApiRequest, res: NextApiResponse, userId: number) => {
  const chatId = Number(req.query.chatId);
  if (!Number.isInteger(chatId) || chatId <= 0) {
    return res.status(400).json({ error: 'Invalid chatId' });
  }

  const dataSource = await getAppDataSource();
  const chat = await dataSource.getRepository(Chat).findOne({ where: { id: chatId, userId } });
  if (!chat) return res.status(404).json({ error: 'Chat not found' });

  const messages = dataSource.getRepository(ChatMessage);
  const files = dataSource.getRepository(ChatFile);

  if (req.method === 'POST') {
    const { userMessage, aiMessage, assistant, fileSrc } = (req.body ?? {}) as Record<string, unknown>;
    if (typeof userMessage !== 'string' || typeof aiMessage !== 'string' || typeof assistant !== 'string') {
      return res.status(400).json({ error: 'userMessage, aiMessage and assistant are required' });
    }
    try {
      const chatMessage = messages.create({ userMessage, aiMessage, assistant, chat: { id: chatId } });
      await messages.save(chatMessage);
      if (Array.isArray(fileSrc) && fileSrc.length) {
        await files.save(
          fileSrc.filter(isRecord).map(fileData =>
            files.create({
              fileData: fileData as unknown as ChatFile['fileData'],
              type: typeof fileData.type === 'string' ? fileData.type : 'unknown',
              chatMessage,
              messageId: chatMessage.id
            })
          )
        );
      }
      return res.status(201).json({ success: true, messageId: chatMessage.id });
    } catch (error) {
      console.error('Error saving message:', error);
      return res.status(500).json({ success: false, error: 'Error saving message' });
    }
  }

  if (req.method === 'GET') {
    try {
      const chatMessages = await messages.find({
        where: { chatId },
        relations: ['files'],
        order: { createdAt: 'ASC' }
      });
      return res.status(200).json(chatMessages);
    } catch (error) {
      console.error('Error fetching messages:', error);
      return res.status(500).json({ error: 'Error fetching messages' });
    }
  }

  res.setHeader('Allow', ['GET', 'POST']);
  return res.status(405).json({ error: `Method ${req.method} not allowed` });
});

export default handler;
