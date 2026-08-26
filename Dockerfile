# TenderBriefing — Cloud Run (PORT 8080)
FROM node:20-alpine AS base
RUN apk add --no-cache libc6-compat
WORKDIR /app

FROM base AS deps
COPY package.json package-lock.json* ./
RUN npm ci

FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .

ARG NEXT_PUBLIC_SITE_URL=https://www.tenderbriefing.co.za
ARG NEXT_PUBLIC_FOUNDER_USER_INTELLIGENCE=false
# Fail-closed: Google Continue UI off unless explicitly enabled at build time.
ARG NEXT_PUBLIC_GOOGLE_AUTH_ENABLED=false
# Fail-closed: Procurement Intelligence UI off unless explicitly enabled at build time.
ARG NEXT_PUBLIC_PROCUREMENT_INTELLIGENCE_ENABLED=false
# Fail-closed: Private tender organisation workspace UI off unless enabled at build time.
ARG NEXT_PUBLIC_PRIVATE_TENDER_ORGANISATION_WORKSPACE_ENABLED=false
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_OPTIONS=--max-old-space-size=4096
ENV NEXT_PUBLIC_SITE_URL=$NEXT_PUBLIC_SITE_URL
ENV NEXT_PUBLIC_FOUNDER_USER_INTELLIGENCE=$NEXT_PUBLIC_FOUNDER_USER_INTELLIGENCE
ENV NEXT_PUBLIC_GOOGLE_AUTH_ENABLED=$NEXT_PUBLIC_GOOGLE_AUTH_ENABLED
ENV NEXT_PUBLIC_PROCUREMENT_INTELLIGENCE_ENABLED=$NEXT_PUBLIC_PROCUREMENT_INTELLIGENCE_ENABLED
ENV NEXT_PUBLIC_PRIVATE_TENDER_ORGANISATION_WORKSPACE_ENABLED=$NEXT_PUBLIC_PRIVATE_TENDER_ORGANISATION_WORKSPACE_ENABLED

RUN npm run build

FROM base AS runner
ENV NODE_ENV=production
ENV PORT=8080
ENV HOSTNAME=0.0.0.0

RUN apk add --no-cache ffmpeg

RUN addgroup --system --gid 1001 nodejs && adduser --system --uid 1001 nextjs

COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/backend ./backend
COPY --from=builder /app/public ./public

USER nextjs
EXPOSE 8080

CMD ["node", "server.js"]
