FROM node:22-alpine AS builder
WORKDIR /app

COPY frontend/package.json frontend/package-lock.json* ./frontend/
RUN npm ci --prefix frontend

COPY frontend ./frontend/
RUN mkdir -p frontend/public
ARG NEXT_PUBLIC_WEB_URL=http://localhost:3000
ENV NEXT_PUBLIC_WEB_URL=$NEXT_PUBLIC_WEB_URL

RUN npm run build --prefix frontend

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

RUN addgroup --system --gid 1001 nodejs && adduser --system --uid 1001 nextjs

COPY --from=builder /app/frontend/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/frontend/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/frontend/.next/static ./.next/static

USER nextjs
EXPOSE 3000
ENV HOSTNAME=0.0.0.0

CMD ["node", "server.js"]
