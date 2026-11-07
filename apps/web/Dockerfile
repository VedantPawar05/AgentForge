# Build Stage
FROM node:22-alpine AS builder

WORKDIR /app

# Copy package definitions and configurations
COPY package*.json tsconfig.base.json ./
COPY packages/ ./packages/
COPY apps/web/ ./apps/web/

# Install dependencies and build Next.js application
RUN npm ci
RUN npm run build --workspace=@agentforge/shared
RUN npm run build --workspace=@agentforge/web

# Production Runner
FROM node:22-alpine AS runner

WORKDIR /app
ENV NODE_ENV=production

# Security: Run as unprivileged node user
USER node

COPY --chown=node:node --from=builder /app/apps/web/public ./apps/web/public
COPY --chown=node:node --from=builder /app/apps/web/.next ./apps/web/.next
COPY --chown=node:node --from=builder /app/node_modules ./node_modules
COPY --chown=node:node --from=builder /app/package*.json ./
COPY --chown=node:node --from=builder /app/apps/web/package.json ./apps/web/package.json

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://localhost:3000 || exit 1

CMD ["npm", "run", "start", "--workspace=@agentforge/web"]
