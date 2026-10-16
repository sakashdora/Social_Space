# Build from the repository root: docker build -f backend/Dockerfile .
FROM node:22-bookworm-slim AS builder
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY package.json package-lock.json ./
COPY backend/package.json ./backend/package.json
COPY frontend/package.json ./frontend/package.json
COPY backend/prisma ./backend/prisma
RUN npm ci --workspace backend --omit=dev --include-workspace-root=false
RUN npm run build --workspace backend
COPY backend/app.js ./backend/app.js
COPY backend/src ./backend/src

FROM node:22-bookworm-slim AS runner
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*
ENV NODE_ENV=production
ENV PORT=3000
WORKDIR /app
COPY --from=builder --chown=node:node /app /app
USER node
WORKDIR /app/backend
EXPOSE 3000
CMD ["node", "app.js"]
