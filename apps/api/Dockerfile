# Build Stage
FROM node:22-alpine AS builder

WORKDIR /app

# Copy package definitions and configurations
COPY package*.json tsconfig.base.json vitest.config.ts ./
COPY packages/ ./packages/
COPY apps/api/ ./apps/api/

# Install dependencies and build workspaces
RUN npm ci
RUN npm run prisma:generate --workspace=@agentforge/db
RUN npm run build --workspace=@agentforge/shared
RUN npm run build --workspace=@agentforge/db
RUN npm run build --workspace=@agentforge/api

# Production Runner
FROM node:22-alpine AS runner

WORKDIR /app
ENV NODE_ENV=production

# Install curl/wget for healthchecks
RUN apk add --no-cache curl wget

# Security: Run as unprivileged non-root user
USER node

COPY --chown=node:node --from=builder /app/package*.json ./
COPY --chown=node:node --from=builder /app/node_modules ./node_modules
COPY --chown=node:node --from=builder /app/packages ./packages
COPY --chown=node:node --from=builder /app/apps/api ./apps/api

EXPOSE 4000

HEALTHCHECK --interval=20s --timeout=3s --start-period=5s --retries=3 \
  CMD wget -qO- http://localhost:4000/health || exit 1

CMD ["node", "apps/api/dist/server.js"]
