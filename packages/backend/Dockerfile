FROM node:20-alpine AS builder

WORKDIR /app

COPY package.json package-lock.json* ./
COPY packages/backend/package.json ./packages/backend/

RUN npm ci --workspace=@foodster/backend

COPY packages/backend/tsconfig.json ./packages/backend/
COPY packages/backend/src ./packages/backend/src

RUN npm run build --workspace=@foodster/backend

FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3001
ENV HOST=0.0.0.0

COPY package.json package-lock.json* ./
COPY packages/backend/package.json ./packages/backend/

RUN npm ci --omit=dev --workspace=@foodster/backend

COPY --from=builder /app/packages/backend/dist ./packages/backend/dist

EXPOSE 3001

CMD ["node", "packages/backend/dist/index.js"]
