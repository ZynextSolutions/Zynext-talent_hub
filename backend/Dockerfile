FROM node:22-alpine AS builder
WORKDIR /app

COPY package.json package-lock.json* ./
COPY backend/package.json backend/package-lock.json* backend/
COPY prisma ./prisma/

RUN npm ci && npm ci --prefix backend

COPY backend ./backend/

RUN npx prisma generate && npm run build --prefix backend

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
RUN apk add --no-cache wget

COPY package.json ./
COPY prisma ./prisma/
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/backend/package.json ./backend/
COPY --from=builder /app/backend/node_modules ./backend/node_modules
COPY --from=builder /app/backend/dist ./backend/dist

EXPOSE 4000
CMD ["sh", "-c", "npx prisma migrate deploy && node backend/dist/index.js"]
