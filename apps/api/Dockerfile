# syntax=docker/dockerfile:1

# ---------------------------------------------------------------------------
# Etapa de build: instala el monorepo y compila la API en un unico archivo.
# El bundle inline-a @caramelo/shared (que se publica como TypeScript crudo),
# por eso el runtime no necesita tsx ni el codigo fuente.
# ---------------------------------------------------------------------------
FROM node:22-alpine AS build

WORKDIR /repo
ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
ENV COREPACK_ENABLE_DOWNLOAD_PROMPT=0
RUN corepack enable

# Manifiestos primero, para cachear el install si no cambian las dependencias.
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json ./
COPY apps/api/package.json ./apps/api/
COPY apps/web/package.json ./apps/web/
COPY packages/shared/package.json ./packages/shared/

RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store \
    pnpm install --frozen-lockfile

COPY packages/shared ./packages/shared
COPY apps/api ./apps/api

RUN pnpm --filter @caramelo/api build

# Deja en /out solo dist + migraciones + dependencias de produccion.
# --legacy: este workspace no usa inject-workspace-packages.
RUN pnpm --filter @caramelo/api deploy --prod --legacy /out

# ---------------------------------------------------------------------------
# Runtime
# ---------------------------------------------------------------------------
FROM node:22-alpine AS runner

WORKDIR /app
ENV NODE_ENV=production

COPY --from=build --chown=node:node /out ./

USER node

# Render inyecta PORT; en Docker directo cae en el default de la app (3001).
EXPOSE 3001

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:' + (process.env.PORT || 3001) + '/api/health').then((r) => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"

CMD ["node", "dist/index.js"]
