# Build Stage
FROM node:22-alpine AS builder

WORKDIR /app

# Copy package definitions and configurations
COPY package*.json tsconfig.base.json vitest.config.ts ./
COPY packages/ ./packages/
COPY apps/worker/ ./apps/worker/

# Install dependencies and build workspaces
RUN npm ci
RUN npm run prisma:generate --workspace=@agentforge/db
RUN npm run build --workspace=@agentforge/shared
RUN npm run build --workspace=@agentforge/db
RUN npm run build --workspace=@agentforge/agent-adapters
RUN npm run build --workspace=@agentforge/sandbox
RUN npm run build --workspace=@agentforge/worker

# Production Runner
FROM node:22-alpine AS runner

WORKDIR /app
ENV NODE_ENV=production

# Install git for repository manipulation and dumb-init for proper signal forwarding
RUN apk add --no-cache git dumb-init

# Security: Run as unprivileged non-root user
USER node

COPY --chown=node:node --from=builder /app/package*.json ./
COPY --chown=node:node --from=builder /app/node_modules ./node_modules
COPY --chown=node:node --from=builder /app/packages ./packages
COPY --chown=node:node --from=builder /app/apps/worker ./apps/worker

ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "apps/worker/dist/worker.js"]
