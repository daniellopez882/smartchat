# ADR 0002 — Configuration is checked where it is used; the schema is a migration

**Status:** accepted

## Context

`config/env.ts` threw at import for `OPENAI_API_KEY`, `PINECONE_API_KEY`,
`JWT_SECRET` and `NEXT_PUBLIC_API_URL`, and `pineconeClient.ts` created the
Pinecone client in a top-level `await`. Any route that imported either — the
login route included — needed every provider configured, and `next build`
could not run without secrets. A user with only a Groq key could not start
the app.

`data-source.ts` had `synchronize: false` and
`migrations: ['src/db/migration/*.ts']`. That directory did not exist, so a
fresh clone had no tables and the first login failed with
`SQLITE_ERROR: no such table: users`. The README's setup step,
`npx typeorm migration:run`, had nothing to run. A test reproduces this on
an empty database.

The login validators were built and never executed (the handler awaited an
array of middleware), and `.escape()` would have altered passwords before
hashing had they run. The rate limiter keyed on `x-forwarded-for`, which any
client can set.

## Decision

- `config/env.ts` exposes live getters and `requireEnv(name)`; nothing runs
  at import. `features.rag`, `features.screenshot`, `features.remoteTools`
  and `features.trustProxy` derive from the environment. A model whose
  provider is missing gets a 503 with a plain message; retrieval without
  Pinecone is a 400; the app itself starts with `JWT_SECRET`,
  `DEFAULT_USERNAME`, `DEFAULT_PASSWORD` and `NEXT_PUBLIC_API_URL` alone.
- Clients (Pinecone, OpenAI embeddings) are built lazily on first use.
- The schema is `src/db/migrations/1700000000000-InitialSchema.ts`, imported
  into the data source (Next bundles the server; globs find nothing) and run
  on first connection. `DATABASE_PATH` selects the file; tests use `:memory:`.
- Login validation runs (`chain.run(req)`), checks lengths only, and the
  limiter keys on the socket address unless `TRUST_PROXY=true`. In
  production the `.env.example` credentials are refused unless
  `ALLOW_DEFAULT_CREDENTIALS=true`.

## Consequences

- The build needs no secrets; CI builds with none.
- A fresh clone works after `cp .env.example .env` and two edits.
- Configuration mistakes surface as specific HTTP errors on the route that
  needs the value, not as a crash at startup.
