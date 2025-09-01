# Build stage
FROM node:18-slim AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# Production stage
FROM node:18-slim AS production
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY --from=build /app/dist ./dist
<<<<<<< HEAD
COPY public ./public
=======
COPY --from=build /app/public ./public
>>>>>>> 46e143b452e019a2e6d60cfdc85100a13f24e5e1
EXPOSE 8080
ENV NODE_ENV=production
ENV PORT=8080
CMD ["node", "dist/server/index.cjs"]
CMD ["pnpm","run","preview","-","-host","0.0.0.0","-port,","8080"]
