FROM node:22-alpine AS base
WORKDIR /app

# Accept backend URL build args so Vite can bake them into the client bundle
ARG VITE_API_URL=""
ARG BACKEND_API_URL=""
ENV VITE_API_URL=$VITE_API_URL
ENV BACKEND_API_URL=$BACKEND_API_URL

# Install all deps
COPY package.json package-lock.json ./
RUN npm install

# Copy source
COPY . .

# Build the frontend application inside the container
RUN npm run build

ENV NODE_ENV=production
ENV PORT=3000
EXPOSE 3000

# TanStack Start production server (Nitro) via vite preview, bound to 0.0.0.0
CMD ["npm", "run", "start"]
