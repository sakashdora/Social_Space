FROM node:22-slim

# Install system dependencies required for Prisma, openssl, etc.
RUN apt-get update -y && apt-get install -y openssl ca-certificates && rm -rf /var/lib/apt/lists/*

# Install pm2 globally
RUN npm install -g pm2

# Create app directory
WORKDIR /usr/src/app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci

# Copy Prisma schema
COPY prisma ./prisma

# Generate Prisma client
RUN npx prisma generate

# Copy the rest of the application files
COPY . .

# Expose the application port
EXPOSE 3000

# Set environment variable for production
ENV NODE_ENV=production

# Run the app using PM2 runtime in cluster mode
CMD ["pm2-runtime", "start", "ecosystem.config.cjs"]
