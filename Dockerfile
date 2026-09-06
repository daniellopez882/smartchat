# node:24-slim (glibc): the dependency set needs Node >= 22 and better-sqlite3 ships prebuilt binaries for it.
FROM node:24-slim AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

FROM deps AS build
COPY . .
ARG NEXT_PUBLIC_API_URL=http://localhost:3000
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL \
    NEXT_TELEMETRY_DISABLED=1
RUN npm run build

FROM node:24-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0 \
    DATABASE_PATH=/data/database.sqlite
RUN groupadd -g 10001 app && useradd -u 10001 -g app -m app \
    && mkdir -p /data && chown app:app /data
# TypeORM loads its driver with a dynamic require that Next's file tracing
# does not follow, so the image ships node_modules rather than a standalone bundle.
COPY --from=deps --chown=app:app /app/node_modules ./node_modules
COPY --from=build --chown=app:app /app/.next ./.next
COPY --from=build --chown=app:app /app/public ./public
COPY --chown=app:app package.json next.config.js ./
USER 10001
VOLUME ["/data"]
EXPOSE 3000
# The screenshot and remote-server tools stay off unless the operator sets
# ENABLE_SCREENSHOT_TOOL / ENABLE_REMOTE_SERVER_TOOLS; neither belongs in a container.
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s \
    CMD node -e "fetch('http://127.0.0.1:3000/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node_modules/.bin/next", "start"]
