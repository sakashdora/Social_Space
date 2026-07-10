# ─── Stage 1: Build ──────────────────────────────────────────────────────────
FROM node:22-alpine AS builder

WORKDIR /usr/src/app

# Upgrade npm inside container to match host lockfile version
RUN npm install -g npm@11.12.1

COPY package*.json ./

# Clean install all dependencies (including devDependencies)
RUN npm ci

COPY . .

# Build the TanStack Start application
RUN npm run build

# ─── Stage 2: Runner ─────────────────────────────────────────────────────────
FROM node:22-alpine AS runner

WORKDIR /usr/src/app

# Upgrade npm in runner stage to match builder/host
RUN npm install -g npm@11.12.1

# Set user to non-root 'node' (predefined in node-alpine image)
USER node

# Copy the compiled output, dependencies, source directories, and configurations needed to run preview
COPY --chown=node:node --from=builder /usr/src/app/dist ./dist
COPY --chown=node:node --from=builder /usr/src/app/node_modules ./node_modules
COPY --chown=node:node --from=builder /usr/src/app/src ./src
COPY --chown=node:node --from=builder /usr/src/app/public ./public
COPY --chown=node:node --from=builder /usr/src/app/package*.json ./
COPY --chown=node:node --from=builder /usr/src/app/vite.config.ts ./
COPY --chown=node:node --from=builder /usr/src/app/tsconfig.json ./
COPY --chown=node:node --from=builder /usr/src/app/components.json ./
COPY --chown=node:node --from=builder /usr/src/app/.env.production ./

# Expose production port
EXPOSE 3000

# Health check using native Node 22 fetch
HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
  CMD node -e "fetch('http://localhost:3000/').then(res => process.exit(res.ok ? 0 : 1)).catch(() => process.exit(1))"

# Start the production server
CMD ["npm", "run", "start"]
