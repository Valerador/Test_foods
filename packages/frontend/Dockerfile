FROM node:20-alpine AS builder

WORKDIR /app

COPY package.json package-lock.json* ./
COPY packages/frontend/package.json ./packages/frontend/

RUN npm ci --workspace=@foodster/frontend

COPY packages/frontend ./packages/frontend

RUN npm run build --workspace=@foodster/frontend

FROM nginx:1.27-alpine AS runner

COPY --from=builder /app/packages/frontend/dist /usr/share/nginx/html
COPY packages/frontend/nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
