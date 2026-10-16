# Build from the repository root: docker build -f frontend/Dockerfile .
FROM node:22-bookworm-slim
WORKDIR /app
ARG VITE_API_URL=""
ENV VITE_API_URL=$VITE_API_URL
COPY package.json package-lock.json ./
COPY backend/package.json ./backend/package.json
COPY frontend/package.json ./frontend/package.json
RUN npm ci --workspace frontend --include-workspace-root=false
COPY frontend ./frontend
RUN npm run build --workspace frontend
ENV NODE_ENV=production
ENV PORT=3000
USER node
EXPOSE 3000
CMD ["npm", "run", "start", "--workspace", "frontend"]
