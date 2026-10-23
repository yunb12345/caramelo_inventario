# Caramelo · Inventario y ventas

Sistema de gestion para un local de ropa: catalogo con variantes por **talle y color**, control de stock, punto de venta, historial de ventas y alertas de reposicion.

## Stack

| Capa | Tecnologia |
| --- | --- |
| Frontend | React 19 + Vite + TypeScript + Tailwind CSS 4 |
| Estado / datos | TanStack Query + React Router |
| Backend | Node + TypeScript + Fastify 5 |
| Base de datos | PostgreSQL + Drizzle ORM |
| Validacion | Zod (esquemas compartidos entre API y front) |
| Auth | JWT + hash scrypt (`node:crypto`, sin dependencias nativas) |

## Estructura

```
caramelo_inventario/
├── apps/
│   ├── api/            API REST (Fastify + Drizzle)
│   │   ├── src/routes/         auth, products, sales, movements, dashboard...
│   │   ├── src/db/schema.ts    esquema de la base
│   │   ├── drizzle/            migraciones SQL generadas
│   │   └── Dockerfile          imagen de produccion (build con esbuild)
│   └── web/            SPA React
│       ├── src/pages/          Dashboard, POS, Productos, Ventas, Movimientos...
│       └── Dockerfile          build + nginx (Docker local o VPS)
├── packages/
│   └── shared/         esquemas Zod y tipos DTO compartidos
├── scripts/            check-db, backup y restore de PostgreSQL
├── .github/workflows/  CI, deploy, seed y backup programado
├── docker-compose.prod.yml
└── render.yaml         blueprint de Render
```

## Requisitos

- Node 22 o superior
- pnpm 11
- PostgreSQL 17 (local o Supabase)

## Puesta en marcha (local)

```bash
pnpm install

# 1. Configurar variables de entorno
# Windows (PowerShell):
Copy-Item apps/api/.env.example apps/api/.env
# macOS / Linux:
cp apps/api/.env.example apps/api/.env
# editar DATABASE_URL, JWT_SECRET, ADMIN_EMAIL, ADMIN_PASSWORD

# 2. Crear las tablas
pnpm db:migrate

# 3. Datos iniciales (usuario admin + catalogo demo opcional)
pnpm db:seed

# 4. Levantar API (3001) y frontend (5173)
pnpm dev
```

Abrir http://localhost:5173 e ingresar con `ADMIN_EMAIL` / `ADMIN_PASSWORD` del `.env`.
Por defecto: `admin@caramelo.local` / `caramelo123`.

> El seed solo crea el catalogo demo si la tabla `products` esta vacia. El usuario admin se crea si no existe.

## Scripts

| Comando | Que hace |
| --- | --- |
| `pnpm dev` | API + frontend en paralelo |
| `pnpm dev:api` | Solo API con recarga en caliente |
| `pnpm dev:web` | Solo frontend |
| `pnpm build` | Build de produccion del frontend |
| `pnpm build:api` | Compila la API a `apps/api/dist` (esbuild) |
| `pnpm build:all` | Build de API + frontend (lo que corre el CI) |
| `pnpm start:api` | Arranca la API compilada (`node dist/index.js`) |
| `pnpm typecheck` | Chequeo de tipos en todo el monorepo |
| `pnpm db:generate` | Genera una migracion a partir de cambios en el schema |
| `pnpm db:migrate` | Aplica migraciones pendientes |
| `pnpm db:push` | Sincroniza el schema sin migracion (solo desarrollo) |
| `pnpm db:seed` | Carga usuario admin y datos demo |
| `pnpm db:check` | Verifica la conexion a la base e imprime el error real si falla |
| `pnpm db:studio` | Abre Drizzle Studio |
| `pnpm backup` | `pg_dump` de `DATABASE_URL` en `backups/` |
| `pnpm restore` | Restaura un `.dump` (pide confirmacion) |

## Usar Supabase

No hace falta instalar nada: el proyecto usa la libreria `pg` contra el connection string de Supabase.

1. Crear un proyecto en [supabase.com](https://supabase.com). Elegir la region pensando donde va a correr la API: `us-east-1` si deployas en Render `virginia`.
2. Ir a **Project Settings → Database → Connection string**.
3. Copiar la cadena **Session pooler** (puerto `5432`) y agregarle `?sslmode=no-verify` al final.
   - **No usar** la *Direct connection* (`db.<project-ref>.supabase.co`): es IPv6-only, y GitHub Actions y Render no tienen IPv6 saliente. Conecta desde tu casa, pero falla en el deploy.
   - **No usar** el *Transaction pooler* (puerto `6543`): las ventas y ajustes de stock usan transacciones SQL y ese modo no las soporta.
   - El usuario del pooler tiene la forma `postgres.<project-ref>`, no `postgres`.
   - `sslmode=no-verify` es necesario porque en `pg` 8.x, `require`/`prefer` se comportan como `verify-full` y el certificado del pooler no valida (`SELF_SIGNED_CERT_IN_CHAIN`). Sin `sslmode`, la conexion va en texto plano.
4. Pegarla en `apps/api/.env`:

```env
DATABASE_URL="postgresql://postgres.<project-ref>:TU_PASSWORD@aws-0-us-east-1.pooler.supabase.com:5432/postgres?sslmode=no-verify"
```

5. Verificar la conexion, aplicar el esquema y crear el admin:

```bash
pnpm db:check
pnpm db:migrate
pnpm db:seed
```

6. Reiniciar la API.

Notas:

- Si la contrasena tiene caracteres especiales (`@`, `#`, `%`, `:`, `/`, `?`), codificala en URL (`@` → `%40`, `#` → `%23`, `%` → `%25`).
- `pnpm db:check` imprime el error real de conexion con una pista. Conviene correrlo antes de `db:migrate` porque `drizzle-kit` oculta ese mensaje cuando no hay TTY (por ejemplo en CI).
- El seed crea el usuario usando `ADMIN_EMAIL` y `ADMIN_PASSWORD` del `.env`.
- La API se conecta con un rol de base de datos, no con la API REST de Supabase: **RLS no interviene**. La seguridad la resuelve el JWT de la aplicacion.
- Los proyectos gratuitos de Supabase se pausan por inactividad; se reactivan desde el panel.

## Deploy en produccion (Render + Supabase)

Arquitectura: Postgres en Supabase (`us-east-1`), API en Render (`virginia`, imagen Docker) y SPA como static site de Render. Las migraciones y los deploys los orquesta GitHub Actions.

```
GitHub Actions (push a main)
  ├─ pnpm typecheck + build
  ├─ pnpm db:migrate  ─────────────► Supabase
  └─ POST deploy hooks ────────────► Render (API) + Render (Web)
```

> La region importa: Render no tiene Sudamerica. Emparejar Supabase `us-east-1` con Render `virginia` evita ~120 ms por query.

### 1. Base de datos

1. Crear el proyecto en Supabase con region `us-east-1`.
2. Copiar la cadena **Session pooler** y dejarla así:

```env
DATABASE_URL="postgresql://postgres.<project-ref>:TU_PASSWORD@aws-0-us-east-1.pooler.supabase.com:5432/postgres?sslmode=no-verify"
```

Dos cosas que no se negocian: **no** la *Direct connection* (`db.<ref>.supabase.co`, que es IPv6-only y no conecta desde GitHub ni Render) y **no** el puerto `6543` (*Transaction pooler*, que rompe las transacciones de venta).

### 2. Secretos en GitHub

Settings → Secrets and variables → Actions:

| Secreto | De donde sale |
| --- | --- |
| `DATABASE_URL` | Supabase, Session pooler |
| `JWT_SECRET` | `node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"` |
| `ADMIN_EMAIL` | email del administrador |
| `ADMIN_PASSWORD` | la clave real del administrador |
| `RENDER_DEPLOY_HOOK_API` | Render → servicio API → Settings → Deploy Hook |
| `RENDER_DEPLOY_HOOK_WEB` | Render → static site → Settings → Deploy Hook |

### 3. Servicios en Render

Render → **New → Blueprint** → elegir el repo. Toma `render.yaml` y crea:

- `caramelo-api`: Docker (`apps/api/Dockerfile`), `healthCheckPath: /api/health`.
- `caramelo-web`: static site, rewrite `/* → /index.html` para React Router.

Al aplicar el blueprint completa los valores `sync: false`:

| Servicio | Variable | Valor |
| --- | --- | --- |
| API | `DATABASE_URL` | Session pooler de Supabase |
| API | `JWT_SECRET` | secreto largo |
| API | `CORS_ORIGIN` | `https://caramelo-web.onrender.com` |
| API | `ADMIN_EMAIL`, `ADMIN_PASSWORD` | credenciales del admin |
| Web | `VITE_API_BASE_URL` | `https://caramelo-api.onrender.com` (sin `/api`) |

`VITE_API_BASE_URL` se congela en el build: si cambia el dominio de la API hay que redeployar el frontend.

Los servicios tienen `autoDeployTrigger: off` a proposito. El deploy lo dispara el workflow después de migrar; si además Render deployara solo, migraciones y deploy podrían correr en paralelo.

### 4. Primer alta del administrador

El seed **no** corre en cada deploy (si el usuario ya existe, no lo toca). Se ejecuta una sola vez:

- Desde GitHub: **Actions → Seed administrador → Run workflow** (deja `demo` en falso para crear solo el admin).
- O desde una máquina con acceso a la base:

  ```bash
  # apps/api/.env con DATABASE_URL de produccion, NODE_ENV=production
  pnpm db:seed
  ```

`SEED_DEMO=false` (o `NODE_ENV=production`) crea solo el administrador, sin catálogo ni ventas de ejemplo.

### 5. Deploys siguientes

```bash
git push origin main
```

CI corre typecheck y build en cada pull request. Al mergear en `main`, el workflow de Deploy repite la validación, verifica la conexión a la base, aplica las migraciones y recién ahí dispara los hooks de Render. Si algo falla antes, no se deploya.

La verificación de conexión (`scripts/check-db.mjs`) existe porque `drizzle-kit migrate` no muestra el error cuando corre sin TTY: el spinner borra la línea y solo queda `Exit status 1`. Ese chequeo imprime el código y el mensaje.

### 6. Backups

```bash
DATABASE_URL="postgresql://..." pnpm backup    # backups/caramelo-<fecha>.dump
DATABASE_URL="postgresql://..." pnpm run restore backups/caramelo-<fecha>.dump
```

El workflow `Backup base de datos` corre todos los días a las 03:00 UTC y deja el dump como artifact por 30 días. **Los proyectos gratuitos de Supabase no tienen backups automáticos.**

Los scripts de backup/restore (y el `psql` del workflow) traducen `sslmode=no-verify` a `sslmode=require`: `no-verify` es propio de `pg` en Node y `pg_dump`/`pg_restore`/`psql` usan libpq, donde `require` ya significa "cifrar sin verificar el certificado".

### Alternativa: una sola maquina con Docker

Para VPS o para probar producción local:

```bash
cp .env.prod.example .env      # completar valores
docker compose -f docker-compose.prod.yml --profile tools run --rm migrate
docker compose -f docker-compose.prod.yml up -d --build
docker compose -f docker-compose.prod.yml --profile tools run --rm seed
```

Queda nginx en `http://localhost:8080` sirviendo la SPA y proxyando `/api` al contenedor `api`.

### Notas de produccion

- La API se compila con esbuild a un único `dist/index.js` (`pnpm build:api`). El bundle inlinea `@caramelo/shared`, así que en producción no hacen falta `tsx` ni el código TypeScript.
- `PORT` lo inyecta Render; no lo definas en `render.yaml`.
- No hay endpoint de cambio de contraseña: si se pierde `ADMIN_PASSWORD`, hay que rehashear a mano en la base.
- El plan free de Render duerme a los 15 minutos (cold start de ~50 s en el POS). Para uso diario, `0.5c-512mb`.

## Modelo de datos

```
users          id, name, email, password_hash
categories     id, name, color
products       id, name, description, brand, category_id, base_price, base_cost, active
variants       id, product_id, sku, barcode, size, color, price, cost, stock, min_stock, active
sales          id, number (autoincremental), subtotal, discount, total, payment_method, note, user_id
sale_items     id, sale_id, variant_id, quantity, unit_price, unit_cost, subtotal
movements      id, variant_id, type, quantity (delta con signo), resulting_stock, reason, reference, sale_id, user_id
```

Reglas clave:

- El **stock vive en `variants`** y solo cambia por movimientos o ventas (nunca editando el campo a mano).
- Cada cambio genera un registro en `movements` (auditoria completa).
- Una venta descuenta stock y crea movimientos tipo `SALE` dentro de una transaccion con bloqueo (`SELECT ... FOR UPDATE`), para evitar sobreventa.
- `variants.price` y `cost` son obligatorios: si no se indican, se copian del producto al crear la variante.

## API

Todas las rutas (salvo login y health) requieren `Authorization: Bearer <token>`.

| Metodo | Ruta | Descripcion |
| --- | --- | --- |
| POST | `/api/auth/login` | Login, devuelve token y usuario |
| GET | `/api/auth/me` | Usuario actual |
| GET | `/api/categories` | Categorias con cantidad de productos |
| POST/PATCH/DELETE | `/api/categories/:id?` | ABM de categorias |
| GET | `/api/products` | Listado paginado (`search`, `categoryId`, `lowStock`, `includeInactive`) |
| GET | `/api/products/:id` | Detalle con variantes |
| POST | `/api/products` | Alta con variantes y stock inicial |
| PATCH/DELETE | `/api/products/:id` | Edicion / baja logica |
| POST | `/api/products/:id/variants` | Agregar variante |
| PATCH/DELETE | `/api/products/:id/variants/:variantId` | Editar / desactivar variante |
| GET | `/api/variants/search?q=` | Busqueda por nombre, SKU, color o codigo de barras |
| GET | `/api/movements` | Historial de movimientos |
| POST | `/api/movements` | Ingreso, egreso o ajuste de stock |
| GET | `/api/sales` | Ventas paginadas (`from`, `to`) |
| GET | `/api/sales/:id` | Comprobante |
| POST | `/api/sales` | Registrar venta (descuenta stock) |
| GET | `/api/dashboard` | KPIs, ventas de 7 dias, stock bajo y ultimas ventas |
| GET | `/api/health` | Estado del servicio |

## Flujo de trabajo diario

1. **Productos → Nuevo producto**: cargar datos base y una variante por talle/color con su stock inicial.
2. **Punto de venta**: buscar o escanear, agregar al carrito, elegir medio de pago y cobrar.
3. **Movimientos**: registrar reposiciones (`Ingreso`), roturas (`Egreso`) o recuentos (`Ajuste`).
4. **Panel**: revisar ventas del dia y variantes que necesitan reposicion.

## Pendientes sugeridos

- Gestion de proveedores y ordenes de compra.
- Devoluciones y cambios (el tipo `RETURN` ya existe en el modelo).
- Exportacion de ventas a CSV / integracion con facturacion electronica.
- Roles y permisos (hoy hay un unico usuario administrador).
- Code splitting del frontend para reducir el bundle inicial.
