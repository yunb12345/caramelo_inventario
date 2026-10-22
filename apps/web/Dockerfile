# syntax=docker/dockerfile:1

# ---------------------------------------------------------------------------
# Build de la SPA. VITE_API_BASE_URL se congela en el bundle: vacio = mismo
# origen (nginx proxya /api), o el dominio del API si se sirve por separado.
# ---------------------------------------------------------------------------
FROM node:22-alpine AS build

WORKDIR /repo
ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
ENV COREPACK_ENABLE_DOWNLOAD_PROMPT=0
RUN corepack enable

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json ./
COPY apps/api/package.json ./apps/api/
COPY apps/web/package.json ./apps/web/
COPY packages/shared/package.json ./packages/shared/

RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store \
    pnpm install --frozen-lockfile

COPY packages/shared ./packages/shared
COPY apps/web ./apps/web

ARG VITE_API_BASE_URL=""
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL

RUN pnpm --filter @caramelo/web build

# ---------------------------------------------------------------------------
# Runtime: nginx con fallback de SPA y proxy hacia el servicio `api`.
# ---------------------------------------------------------------------------
FROM nginx:1.27-alpine AS runner

COPY apps/web/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /repo/apps/web/dist /usr/share/nginx/html

EXPOSE 80
