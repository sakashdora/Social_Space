FROM node:22-alpine AS base
RUN apk add --no-cache openssl3 openssl-dev python3 make g++ vips-dev

FROM base AS deps
WORKDIR /app
COPY package.json package-lock.json ./
# Include devDependencies so `prisma generate` in the builder stage has the prisma CLI available.
# The runner stage only copies the final generated client, not all of node_modules.
RUN npm ci

FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY package.json package-lock.json ./
COPY prisma ./prisma/
RUN npx prisma generate
COPY src ./src/
COPY app.js ./

FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000
RUN apk add --no-cache openssl3 vips
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nodejs
RUN mkdir -p /app/tmp/uploads && chown -R nodejs:nodejs /app/tmp
COPY --from=builder --chown=nodejs:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=nodejs:nodejs /app/src ./src
COPY --from=builder --chown=nodejs:nodejs /app/app.js ./
COPY --from=builder --chown=nodejs:nodejs /app/prisma ./prisma
COPY --from=builder --chown=nodejs:nodejs /app/package.json ./
USER nodejs
EXPOSE 3000
CMD ["node", "app.js"]