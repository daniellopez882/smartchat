import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * The schema the entities describe. The data source ran with
 * `synchronize: false` and `migrations: ['src/db/migration/*.ts']` — a
 * directory that did not exist — so a fresh clone had no tables at all and
 * the first login failed with "no such table: users". The README's
 * `npx typeorm migration:run` had nothing to run.
 */
export class InitialSchema1700000000000 implements MigrationInterface {
  name = 'InitialSchema1700000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "users" (
        "id" integer PRIMARY KEY AUTOINCREMENT NOT NULL,
        "username" varchar(255) NOT NULL,
        "password" varchar(255) NOT NULL,
        CONSTRAINT "UQ_users_username" UNIQUE ("username")
      )`);
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "ai_configs" (
        "id" integer PRIMARY KEY AUTOINCREMENT NOT NULL,
        "name" varchar NOT NULL,
        "role" varchar NOT NULL,
        "model" text NOT NULL,
        "topP" float NOT NULL,
        "temperature" float NOT NULL,
        "basePrompt" text NOT NULL,
        "metadata" text,
        "createdAt" datetime NOT NULL DEFAULT (datetime('now')),
        "userId" integer NOT NULL,
        CONSTRAINT "FK_ai_configs_user" FOREIGN KEY ("userId") REFERENCES "users" ("id")
      )`);
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "chats" (
        "id" integer PRIMARY KEY AUTOINCREMENT NOT NULL,
        "title" text NOT NULL,
        "createdAt" datetime NOT NULL DEFAULT (datetime('now')),
        "metadata" text,
        "tags" text,
        "userId" integer NOT NULL,
        CONSTRAINT "FK_chats_user" FOREIGN KEY ("userId") REFERENCES "users" ("id")
      )`);
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "chat_messages" (
        "id" integer PRIMARY KEY AUTOINCREMENT NOT NULL,
        "userMessage" text NOT NULL,
        "aiMessage" text NOT NULL,
        "assistant" text NOT NULL,
        "createdAt" datetime NOT NULL DEFAULT (datetime('now')),
        "metadata" text,
        "chatId" integer NOT NULL,
        CONSTRAINT "FK_chat_messages_chat" FOREIGN KEY ("chatId") REFERENCES "chats" ("id")
      )`);
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "chat_files" (
        "id" integer PRIMARY KEY AUTOINCREMENT NOT NULL,
        "fileData" text,
        "type" varchar NOT NULL,
        "messageId" integer NOT NULL,
        CONSTRAINT "FK_chat_files_message" FOREIGN KEY ("messageId") REFERENCES "chat_messages" ("id")
      )`);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_chat_messages_chatId" ON "chat_messages" ("chatId")`
    );
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_chats_userId" ON "chats" ("userId")`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    for (const table of ['chat_files', 'chat_messages', 'chats', 'ai_configs', 'users']) {
      await queryRunner.query(`DROP TABLE IF EXISTS "${table}"`);
    }
  }
}
