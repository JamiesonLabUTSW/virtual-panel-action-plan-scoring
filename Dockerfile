# Multi-Judge LLM Grading Demo - Optimized Production Dockerfile
# Targets: <500MB image size, multi-platform support, maximum build cache efficiency
# Architecture: 3-stage build (client → server → runtime)

# ============================================================================
# Stage 1: Client Build
# ============================================================================
FROM node:24-slim AS client-build

# Install build essentials for native dependencies (minimal layer)
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
    python3 \
    make \
    g++ \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Layer 1: Copy package files for ALL workspaces (npm ci --workspaces needs them all)
COPY package*.json ./
COPY shared/package*.json ./shared/
COPY client/package*.json ./client/
COPY server/package*.json ./server/

# Layer 2: Install ALL dependencies (includes devDependencies needed for build)
RUN npm ci --workspaces --include-workspace-root --prefer-offline --no-audit \
    && npm cache clean --force

# Layer 3: Copy source files (changes frequently, placed after deps)
COPY shared/ ./shared/
COPY client/ ./client/

# Layer 4: Build client with production optimizations
# Vite build includes: minification, tree-shaking, code splitting, asset optimization
WORKDIR /app/client
RUN npm run build

# Verify build output exists (fail-fast if build failed silently)
RUN test -f dist/index.html || (echo "Client build failed - index.html not found" && exit 1)

# ============================================================================
# Stage 2: Server Build
# ============================================================================
FROM node:24-slim AS server-build

# Install build essentials for native dependencies
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
    python3 \
    make \
    g++ \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Layer 1: Copy package files for ALL workspaces (npm ci --workspaces needs them all)
COPY package*.json ./
COPY shared/package*.json ./shared/
COPY client/package*.json ./client/
COPY server/package*.json ./server/

# Layer 2: Install dependencies with same optimizations
RUN npm ci --workspaces --include-workspace-root --prefer-offline --no-audit \
    && npm cache clean --force

# Layer 3: Copy source files
COPY shared/ ./shared/
COPY server/ ./server/

# Layer 4: Build server with tsup (bundles shared/ code inline)
# tsup config: noExternal: ["@shared"] ensures no runtime path resolution needed
WORKDIR /app/server
RUN npm run build

# Verify build output and resources directory
RUN test -f dist/index.cjs || (echo "Server build failed - index.cjs not found" && exit 1) \
    && test -f dist/rubric.txt || (echo "Server resources not copied - rubric.txt missing" && exit 1)

# ============================================================================
# Stage 3: Optimized Runtime
# ============================================================================
FROM node:24-slim

# Add metadata labels for container registry
LABEL org.opencontainers.image.title="Multi-Judge Grading Demo"
LABEL org.opencontainers.image.description="Calibrated LLM-as-a-judge panel on Hugging Face Spaces"
LABEL org.opencontainers.image.vendor="Michael"

# Install only runtime dependencies (not build tools)
# tini: proper PID 1 for signal handling and zombie process reaping
# curl: for efficient health checks
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
    tini \
    ca-certificates \
    curl \
    && rm -rf /var/lib/apt/lists/* \
    && apt-get clean

WORKDIR /app
RUN chown node:node /app

# Copy package.json for npm metadata (needed by Node.js at runtime)
COPY --chown=node:node --from=server-build /app/server/package*.json ./

# Install as node user so node_modules is owned correctly
USER node

# Strategy: Re-install with --omit=dev for clean production dependencies
# This is MORE efficient than copying node_modules because:
# 1. Excludes all devDependencies (tsup, tsx, @types/*, vitest, etc.)
# 2. Produces smaller, cleaner dependency tree
# 3. npm prunes unused transitive dependencies automatically
RUN npm install --omit=dev --no-audit \
    && npm cache clean --force

# Copy built artifacts from build stages
COPY --chown=node:node --from=server-build /app/server/dist ./dist
COPY --chown=node:node --from=client-build /app/client/dist ./public

# Expose port (HF Spaces requirement)
EXPOSE 7860

# Environment variable defaults (overridden by HF Spaces secrets)
ENV NODE_ENV=production
ENV PORT=7860

# Health check for container orchestration
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD curl -f http://localhost:7860/api/health || exit 1

# Use tini as PID 1 for proper signal handling
ENTRYPOINT ["/usr/bin/tini", "--"]

# Start server
CMD ["node", "dist/index.cjs"]
