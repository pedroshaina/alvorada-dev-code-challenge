FROM node:24-slim AS base
RUN apt-get update && apt-get install -y --no-install-recommends openssl && rm -rf /var/lib/apt/lists/* \
  && corepack enable
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json ./

FROM base AS api
COPY apps/api/package.json apps/api/prisma.config.ts apps/api/
COPY apps/api/prisma apps/api/prisma
RUN pnpm install --frozen-lockfile --filter @reservations/api
COPY apps/api apps/api
WORKDIR /app/apps/api
ENV PATH=/app/apps/api/node_modules/.bin:$PATH
CMD ["sh", "-c", "prisma migrate deploy && exec tsx src/main.ts"]

FROM base AS web-build
COPY apps/web/package.json apps/web/
RUN pnpm install --frozen-lockfile --filter @reservations/web
COPY apps/web apps/web
RUN pnpm --filter @reservations/web build

FROM nginx:1.29-alpine AS web
COPY docker/nginx/default.conf /etc/nginx/conf.d/default.conf
COPY --from=web-build /app/apps/web/dist /usr/share/nginx/html
