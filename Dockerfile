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
