# HomeFit Application Dockerfile
# Multi-stage build for optimized production image

# ============================================
# Stage 1: Build Frontend
# ============================================
FROM node:20-alpine AS frontend-builder

WORKDIR /app/client

# Copy frontend package files
COPY src/client/package*.json ./

# Install dependencies
RUN npm ci

# Copy frontend source
COPY src/client/ ./

# Build frontend
RUN npm run build

# ============================================
# Stage 2: Build Backend
# ============================================
FROM node:20-alpine AS backend-builder

WORKDIR /app/server

# Copy backend package files
COPY src/server/package*.json ./

# Install dependencies
RUN npm ci

# Copy backend source
COPY src/server/ ./

# Generate Prisma client
RUN npx prisma generate

# Build backend (if using TypeScript)
RUN npm run build 2>/dev/null || true

# ============================================
# Stage 3: Production Image
# ============================================
FROM node:20-alpine AS production

# Install dumb-init for proper signal handling
RUN apk add --no-cache dumb-init

# Create non-root user
RUN addgroup -g 1001 -S homefit && \
    adduser -S homefit -u 1001

WORKDIR /app

# Copy package files
COPY src/server/package*.json ./

# Install production dependencies only
RUN npm ci --only=production

# Copy Prisma schema and generate client
COPY src/server/prisma ./prisma
RUN npx prisma generate

# Copy built backend
COPY --from=backend-builder /app/server/dist ./dist 2>/dev/null || true
COPY --from=backend-builder /app/server/src ./src

# Copy built frontend to serve statically
COPY --from=frontend-builder /app/client/dist ./public

# Copy exercise database (JSON only for smaller image)
COPY exercises-db/dist/exercises.json ./data/exercises.json
COPY exercises-db/schema.json ./data/schema.json

# Create directories for uploads and logs
RUN mkdir -p uploads logs backups && \
    chown -R homefit:homefit /app

# Switch to non-root user
USER homefit

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:3000/api/health || exit 1

# Start with dumb-init
ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "src/index.js"]
