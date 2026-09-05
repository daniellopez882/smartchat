# ADR 0001 — Every API route authenticates; host-level tools are opt-in

**Status:** accepted

## Context

`withAuth` existed and wrapped the four chat-and-config routes. Five routes
were not wrapped:

| Route | What an anonymous caller could do |
|---|---|
| `POST /api/ai/chat` | Spend the operator's OpenAI/Anthropic/Gemini/Groq credit |
| `POST /api/tools/upload` | Write any file to the server's disk and pay for its embeddings |
| `POST /api/tools/screenshot` | Receive a screenshot of the host machine's desktop |
| `POST /api/tools/startserver` | Start an EC2 instance, then SSH into it using **a private key read from a path in the request body** and run `systemctl start <appName>` — with `appName` unvalidated |
| `POST /api/tools/stopserver` | The same, with `stop` |

The README's deployment advice was to expose the app with ngrok.

## Decision

1. `withAuth` wraps every route except `/api/auth/login` and `/api/health`.
   A test imports each handler and asserts a 401 without a token and with a
   token signed by another secret.
2. Tools that act on the host or on cloud resources do not exist unless the
   operator enables them: `ENABLE_SCREENSHOT_TOOL`, `ENABLE_REMOTE_SERVER_TOOLS`
   (the latter also requires `REMOTE_SERVER_PEM_PATH`). Disabled routes answer
   404 even to authenticated callers.
3. The remote-server routes validate every field against a strict shape
   (`i-…` instance id, IPv4 or hostname, Unix user name, systemd unit name)
   and take the key path from the environment only. A `pemPath` in the body is
   rejected. The unit name is checked again immediately before it is
   interpolated into the SSH command.
4. Routes that operate on a chat check that the chat belongs to the caller.
   `DELETE`/`PUT /api/chats/[id]` and `/api/chats/[id]/messages` looked chats up
   by id alone.
5. The client sends the token on the chat, upload and screenshot calls.

## Consequences

- An unauthenticated request cannot spend money, read the screen, or reach a
  cloud host. A stolen token still can — the threat model covers token
  storage.
- Operators who never wanted the screenshot or EC2 tools no longer run them.
- The default configuration is a chat app with a login, which is what the
  README describes.
