# Stage 1: deps — install production dependencies only
FROM node:24-alpine AS deps

RUN apk add --no-cache libc6-compat openssl

WORKDIR /app

COPY package.json package-lock.json ./

RUN npm ci --production --no-audit --no-fund

# Stage 2: builder — generate Prisma Client (needs prisma CLI + node_modules)
FROM node:24-alpine AS builder

RUN apk add --no-cache libc6-compat openssl

WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY package.json package-lock.json ./
COPY prisma ./prisma
COPY src ./src
COPY app.js ./

RUN npx prisma generate

# Remove test files from the final artifact
RUN rm -rf src/tests

# Stage 3: runner — minimal production image, non-root user
FROM node:24-alpine AS runner

RUN apk add --no-cache libc6-compat openssl && \
    addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001 -G nodejs

WORKDIR /app

ENV NODE_ENV=production \
    PORT=3000

COPY --from=builder --chown=nodejs:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=nodejs:nodejs /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder --chown=nodejs:nodejs /app/prisma ./prisma
COPY --from=builder --chown=nodejs:nodejs /app/src ./src
COPY --from=builder --chown=nodejs:nodejs /app/app.js ./

RUN mkdir -p /app/tmp && chown -R nodejs:nodejs /app/tmp

USER nodejs

EXPOSE 3000

CMD ["node", "app.js"]
