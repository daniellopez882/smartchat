import type { NextApiRequest, NextApiResponse } from 'next';

import { env, features } from '@/config/env';
import { withAuth } from '@/src/middleware/auth';
import { BadRequestError, isRecord, withMethods } from '@/src/middleware/guards';
import { AIProviderFactory } from '@/src/services/llm/AIProviderFactory';
import { UserInputError } from '@/src/services/llm/CustomErrorTypes';
import { fetchDataFromPinecone } from '@/src/services/rag/fetchDataFromPinecone';
import { createEmbedding } from '@/src/services/rag/embedding';
import type { AssistantOption, FileData, Message } from '@/src/types/chat';
import { processImageFiles, processNonMediaFiles } from '@/src/utils/fileHelper/processMessageFile';
import { extractMessageContent, extractSubjectTitle } from '@/src/utils/guardrails/chatMessageHelper';

export const CATEGORIES = ['openai', 'anthropic', 'google', 'groq', 'hf-small', 'hf-large'] as const;
export type Category = (typeof CATEGORIES)[number];
export const MAX_QUESTION_CHARS = 20_000;
export const MAX_FILES = 10;
export const NAMESPACE = /^[A-Za-z0-9][A-Za-z0-9_.-]{0,63}$/;

export interface ChatRequest {
  question: string;
  fileSrc: FileData[];
  chatHistory: Message[];
  namespace: string | null;
  selectedAssistant: AssistantOption;
  category: Category;
}

const isFileData = (v: unknown): v is FileData =>
  isRecord(v) &&
  typeof v.base64Content === 'string' &&
  typeof v.type === 'string' &&
  typeof v.name === 'string' &&
  typeof v.size === 'number';

const isMessage = (v: unknown): v is Message =>
  isRecord(v) && typeof v.question === 'string' && typeof v.answer === 'string';

/** Shape-checks the body; the old handler dereferenced it blind (`fileSrc.length`). */
export function parseChatRequest(body: unknown): ChatRequest {
  if (!isRecord(body)) throw new BadRequestError('Body must be a JSON object');
  const question = typeof body.question === 'string' ? body.question : '';
  if (question.length > MAX_QUESTION_CHARS) {
    throw new BadRequestError(`question must be at most ${MAX_QUESTION_CHARS} characters`);
  }
  const fileSrc = body.fileSrc === undefined ? [] : body.fileSrc;
  if (!Array.isArray(fileSrc) || fileSrc.length > MAX_FILES || !fileSrc.every(isFileData)) {
    throw new BadRequestError(`fileSrc must be an array of at most ${MAX_FILES} files`);
  }
  const chatHistory = body.chatHistory === undefined ? [] : body.chatHistory;
  if (!Array.isArray(chatHistory) || !chatHistory.every(isMessage)) {
    throw new BadRequestError('chatHistory must be an array of messages');
  }
  if (!question.trim() && fileSrc.length === 0) {
    throw new BadRequestError('No question in the request');
  }
  const assistant = body.selectedAssistant;
  const model = isRecord(assistant) && isRecord(assistant.config) ? assistant.config.model : undefined;
  const category = isRecord(model) ? model.category : undefined;
  if (!isRecord(model) || typeof model.value !== 'string' || !model.value) {
    throw new BadRequestError('Model name is missing');
  }
  if (typeof category !== 'string' || !(CATEGORIES as readonly string[]).includes(category)) {
    throw new BadRequestError('Invalid model category');
  }
  let namespace: string | null = null;
  if (typeof body.namespace === 'string' && body.namespace !== 'none' && body.namespace !== '') {
    if (!NAMESPACE.test(body.namespace)) throw new BadRequestError('Invalid namespace');
    namespace = body.namespace;
  }
  return {
    question,
    fileSrc,
    chatHistory,
    namespace,
    selectedAssistant: assistant as AssistantOption,
    category: category as Category
  };
}

/** The credentials for a provider category, or an explanation of what is missing. */
export function providerCredentials(category: Category): { apiKey: string; baseUrl?: string } {
  switch (category) {
    case 'openai':
      return { apiKey: env.OPENAI_API_KEY };
    case 'anthropic':
      return { apiKey: env.CLAUDE_API_KEY };
    case 'google':
      return { apiKey: env.GEMINI_API_KEY };
    case 'groq':
      return { apiKey: env.GROQ_API_KEY };
    case 'hf-small':
      return { apiKey: env.NEXT_PUBLIC_SERVER_SECRET_KEY, baseUrl: env.NEXT_PUBLIC_SERVER_URL };
    case 'hf-large':
      return { apiKey: env.NEXT_PUBLIC_SERVER_SECRET_KEY, baseUrl: env.NEXT_PUBLIC_SERVER_GPU_URL };
  }
}

const handler = withAuth(
  withMethods(['POST'], async (req: NextApiRequest, res: NextApiResponse) => {
    let request: ChatRequest;
    try {
      request = parseChatRequest(req.body);
    } catch (error) {
      if (error instanceof BadRequestError) return res.status(400).json({ error: error.message });
      throw error;
    }
    const { fileSrc, chatHistory, namespace, selectedAssistant, category } = request;

    const { apiKey, baseUrl } = providerCredentials(category);
    if (!apiKey) {
      return res.status(503).json({ error: `The ${category} provider is not configured on this server` });
    }
    if ((category === 'hf-small' || category === 'hf-large') && !baseUrl) {
      return res.status(503).json({ error: `The self-hosted ${category} server URL is not configured` });
    }
    if (namespace && !features.rag) {
      return res.status(400).json({ error: 'Retrieval (RAG) is not enabled on this server' });
    }

    try {
      const base64ImageSrc = processImageFiles(fileSrc);
      const question = (request.question + (await processNonMediaFiles(fileSrc)))
        .trim()
        .replace(/\n\s*\n/g, '\n');

      // Retrieval: an empty namespace now means "no context", not a failed request.
      let fetchedText = '';
      if (namespace) {
        fetchedText = await fetchDataFromPinecone(await createEmbedding(question), namespace);
      }

      const provider = AIProviderFactory.createProvider(category, apiKey, baseUrl);
      const chatResponse = await provider.getChatCompletion(
        chatHistory,
        question,
        fetchedText,
        selectedAssistant,
        base64ImageSrc
      );

      if (!chatResponse) {
        return res.status(200).json({
          answer: "Sorry, I'm having trouble finding an answer to your question.",
          subject: 'Unknown'
        });
      }
      return res.status(200).json({
        answer: extractMessageContent(chatResponse),
        subject: extractSubjectTitle(chatResponse)
      });
    } catch (error) {
      console.error('Chat request failed:', error);
      if (error instanceof UserInputError) {
        return res.status(400).json({ error: error.message });
      }
      const selfHosted = category === 'hf-small' || category === 'hf-large';
      return res.status(502).json({
        error: selfHosted
          ? 'This model requires the self-hosted service. Please ensure it is running before making queries.'
          : 'The AI provider did not return a response. Please try again.'
      });
    }
  })
);

export default handler;
