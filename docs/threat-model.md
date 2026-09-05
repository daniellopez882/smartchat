# Threat model

Scope: a single-user Next.js chat application with a JWT login, SQLite
storage, optional Pinecone retrieval, calls to four model providers, and two
optional tools that act on the host machine and on AWS. Designed to run on a
personal machine; the README used to suggest exposing it with ngrok.

## What it holds

| Asset | Where | Why it matters |
|---|---|---|
| Provider keys (OpenAI, Anthropic, Gemini, Groq, Pinecone) | environment | Billable on every request |
| `JWT_SECRET` | environment | Forges sessions if leaked |
| The SSH private key for the remote host | `REMOTE_SERVER_PEM_PATH` | Root on that host |
| AWS credentials | environment | Start/stop instances |
| Conversations and uploaded document text | `database.sqlite`, Pinecone | Whatever the user pasted or uploaded |
| The host's screen | the screenshot tool | Everything on the desktop |

## Threats

### T1 — Anonymous use of paid and dangerous routes *(was open)*

Chat, upload, screenshot and the EC2/SSH tools accepted requests without a
token. **Controls.** `withAuth` on every route but login and health; a test
walks the routes. The host/cloud tools are additionally off unless enabled.
See [ADR 0001](adr/0001-every-route-authenticates.md).

### T2 — Command injection and arbitrary file read through the server tools *(was open)*

`appName` was interpolated into `systemctl start ${appName}` and `pemPath`
was read from disk, both straight from the request body. **Controls.** Strict
shapes for every field, the key path from the environment only, the unit name
re-checked before the command is built, and the feature off by default.
**Residual.** The SSH user can run `systemctl` on that host; scope the key
and user accordingly.

### T3 — Broken login protections *(was open)*

Validators never ran; the limiter trusted `x-forwarded-for`; the
`.env.example` credentials created the only user on first login.
**Controls.** Validators executed; limiter keyed on the socket address unless
`TRUST_PROXY`; shipped defaults refused in production unless explicitly
allowed. **Residual.** Single-factor login; no lockout beyond the 15-minute
window.

### T4 — Session token in `localStorage`

The client stores the JWT in `localStorage` and sends it as a bearer header,
so any script injection on the page can read it. Model replies are rendered
as HTML (`marked`, sanitised with `isomorphic-dompurify`). **Controls.**
DOMPurify on rendered replies; the token expires in 12 hours. **Residual.**
Moving the token to an `HttpOnly` cookie would remove the exposure; this
change did not touch the client's session handling beyond sending the header
where it was missing.

### T5 — Uploads

Any file of any size was written to disk and handed to a PDF loader.
**Controls.** PDF only, 20 MB, one file, fields validated, temp file removed
in `finally`, route disabled without Pinecone. **Residual.** A malicious PDF
still reaches `pdf-parse`; keep it patched.

### T6 — Prompt injection through retrieved and uploaded text

Uploaded documents and pasted files become model context. **Controls.**
None beyond the provider's own; the app has no tools the model can call.
**Residual.** A document can steer the answer.

### T7 — Dependency advisories

`next@14.2.13`, `langchain@0.0.96` (and the old `axios` under it), `sqlite3`'s
install chain and several transitive packages carried advisories; `xlsx` has
none fixed on the npm registry. **Controls.** Next 15.5; the four LangChain
imports moved to the split `@langchain/*` packages; `better-sqlite3` instead of
`sqlite3`; `xlsx` from SheetJS's own distribution; npm with `overrides` and
`npm audit fix`; CI runs `audit-ci` at high severity and `.audit-allowlist.json`
lists only advisories without a published fix, each with a reason.
**Residual.** The `xlsx` parser runs on user-supplied spreadsheets; a
malformed file can at worst tie up the request.

### T8 — The screenshot tool

Returns the desktop of the machine running the server. **Controls.** Off
unless `ENABLE_SCREENSHOT_TOOL=true`; authenticated; dynamic import so the
native helper is never loaded otherwise. **Residual.** When enabled, anyone
with a valid token sees the screen — which is the feature.

## Not addressed

- Multi-user isolation beyond chat ownership: the app is for one person.
- Encryption at rest for `database.sqlite`.
- Rate limiting on the chat route (model spend per token holder).
