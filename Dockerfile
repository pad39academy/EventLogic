# Multi-stage build for frontend and no-bundle server
FROM node:18-slim AS frontend-build

# Build frontend only (avoid server bundling issues)
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY client/ ./client/
COPY shared/ ./shared/
COPY vite.config.ts ./vite.config.ts
COPY tailwind.config.ts ./tailwind.config.ts
COPY postcss.config.js ./postcss.config.js
COPY tsconfig.json ./tsconfig.json
COPY components.json ./components.json

# Build frontend from project root (not from client dir)
RUN npx vite build --emptyOutDir

# Production stage with no-bundle server
FROM node:18-slim AS production
WORKDIR /app

# Install production dependencies
COPY package*.json ./
RUN npm ci --omit=dev

# Copy source code for tsx runtime (no bundling)
COPY server/ ./server/
COPY shared/ ./shared/
COPY viteProd.ts ./viteProd.ts
COPY viteDev.ts ./viteDev.ts
COPY drizzle.config.ts ./drizzle.config.ts
COPY tsconfig.json ./tsconfig.json

# Copy built frontend assets from build stage
COPY --from=frontend-build /app/dist ./dist

# Copy static files
COPY public/ ./public/
COPY error-page.html ./error-page.html
COPY mobile-iframe.html ./mobile-iframe.html

# Install tsx globally for TypeScript runtime  
RUN npm install -g tsx

# Install tsconfig-paths for runtime path resolution
RUN npm install --save tsconfig-paths

# Expose port
EXPOSE 5000
ENV NODE_ENV=production
ENV PORT=5000

# Use tsx with tsconfig-paths for proper alias resolution
CMD ["tsx", "--require", "tsconfig-paths/register", "server/index.ts"]