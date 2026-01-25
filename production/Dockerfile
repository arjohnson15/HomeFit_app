# HomeFit Production Dockerfile
# Multi-stage build for optimized production image

ARG NODE_VERSION=20
ARG APP_VERSION=1.0.0

# ============================================
# Stage 1: Build Frontend
# ============================================
FROM node:${NODE_VERSION}-alpine AS frontend-builder

WORKDIR /app/client

# Copy frontend package files
COPY src/client/package*.json ./

# Install dependencies
RUN npm ci --legacy-peer-deps

# Copy frontend source
COPY src/client/ ./

# Build frontend for production
RUN npm run build

# ============================================
# Stage 2: Build Backend
# ============================================
FROM node:${NODE_VERSION}-alpine AS backend-builder

WORKDIR /app/server

# Copy backend package files
COPY src/server/package*.json ./

# Install all dependencies (including dev for prisma generate)
RUN npm ci

# Copy backend source
COPY src/server/ ./

# Generate Prisma client
RUN npx prisma generate

# ============================================
# Stage 3: Production Image
# ============================================
FROM node:${NODE_VERSION}-alpine AS production

ARG APP_VERSION=1.0.0
ENV APP_VERSION=${APP_VERSION}
ENV NODE_ENV=production

# Install dumb-init for proper signal handling, OpenSSL for Prisma, and other utilities
RUN apk add --no-cache dumb-init curl wget openssl

# Create non-root user
RUN addgroup -g 1001 -S homefit && \
    adduser -S homefit -u 1001

WORKDIR /app

# Copy server package files for dependencies
COPY src/server/package*.json ./

# Install production dependencies only
RUN npm ci --only=production && npm cache clean --force

# Copy root package.json for version info (after npm ci so it doesn't interfere)
COPY package.json ./root-package.json

# Copy Prisma schema and generate client
COPY src/server/prisma ./prisma
RUN npx prisma generate

# Copy entrypoint script
COPY production/entrypoint.sh ./entrypoint.sh
RUN chmod +x ./entrypoint.sh

# Copy built backend source
COPY --from=backend-builder /app/server/src ./src

# Copy built frontend to serve statically
COPY --from=frontend-builder /app/client/dist ./public

# Copy exercise database and data files
COPY exercises-db/dist/exercises.json ./data/exercises.json
COPY exercises-db/schema.json ./data/schema.json
COPY src/server/data/warmup-cooldown-mappings.json ./data/warmup-cooldown-mappings.json
COPY exercises-db/exercises ./data/exercises

# Create directories for uploads, logs, and backups
RUN mkdir -p uploads logs backups data && \
    chown -R homefit:homefit /app

# Copy version info
RUN echo "${APP_VERSION}" > /app/VERSION

# Switch to non-root user
USER homefit

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:3000/api/health || exit 1

# Labels for versioning
LABEL org.opencontainers.image.version="${APP_VERSION}" \
      org.opencontainers.image.title="HomeFit" \
      org.opencontainers.image.description="HomeFit Workout Tracking Application" \
      org.opencontainers.image.source="https://github.com/arjohnson15/HomeFit_app"

# Start with dumb-init for proper signal handling
# Entrypoint runs migrations automatically before starting
ENTRYPOINT ["dumb-init", "--"]
CMD ["./entrypoint.sh"]
