# syntax=docker/dockerfile:1

FROM node:20-alpine AS builder
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci
COPY tsconfig.json ./
COPY src ./src
COPY manifest.json ./
RUN npm run build

FROM node:20-alpine AS runtime
WORKDIR /app
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/manifest.json ./
COPY package.json ./

ENV NODE_ENV=production
ENV PORT=4400
EXPOSE 4400

# Run the HTTP transport for production hosting (ChatGPT Apps connect via SSE)
CMD ["node", "dist/server.js", "--transport=http", "--port=4400"]
