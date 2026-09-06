import AppDataSourceSingleton, { createDataSource } from '@/src/db/data-source';
import { User, Chat, ChatMessage, ChatFile, AIConfig } from '@/src/db/entities';

const getAppDataSource = AppDataSourceSingleton.getInstance;
const setAppDataSource = AppDataSourceSingleton.setInstance;

export { getAppDataSource, setAppDataSource, createDataSource, User, Chat, ChatMessage, ChatFile, AIConfig };
