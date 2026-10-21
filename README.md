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
│   │   └── drizzle/            migraciones SQL generadas
│   └── web/            SPA React
│       └── src/pages/          Dashboard, POS, Productos, Ventas, Movimientos...
└── packages/
    └── shared/         esquemas Zod y tipos DTO compartidos
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
| `pnpm typecheck` | Chequeo de tipos en todo el monorepo |
| `pnpm db:generate` | Genera una migracion a partir de cambios en el schema |
| `pnpm db:migrate` | Aplica migraciones pendientes |
| `pnpm db:push` | Sincroniza el schema sin migracion (solo desarrollo) |
| `pnpm db:seed` | Carga usuario admin y datos demo |
| `pnpm db:studio` | Abre Drizzle Studio |

## Usar Supabase

No hace falta instalar nada: el proyecto usa la libreria `pg` contra el connection string de Supabase.

1. Crear un proyecto en [supabase.com](https://supabase.com) (elegir region `sa-east-1` para Argentina).
2. Ir a **Project Settings → Database → Connection string**.
3. Copiar la cadena **Session pooler** (puerto `5432`).
   - **No usar** el *Transaction pooler* (puerto `6543`): las ventas y ajustes de stock usan transacciones SQL y ese modo no las soporta.
   - Si el plan permite *Direct connection*, tambien sirve.
4. Pegarla en `apps/api/.env`:

```env
DATABASE_URL="postgresql://postgres.xxxxxxxx:TU_PASSWORD@aws-0-sa-east-1.pooler.supabase.com:5432/postgres?sslmode=require"
```

5. Aplicar el esquema y crear el admin:

```bash
pnpm db:migrate
pnpm db:seed
```

6. Reiniciar la API.

Notas:

- Si la contrasena tiene caracteres especiales (`@`, `#`, `%`), codificala en URL (`@` → `%40`).
- El seed crea el usuario usando `ADMIN_EMAIL` y `ADMIN_PASSWORD` del `.env`.
- La API se conecta con un rol de base de datos, no con la API REST de Supabase: **RLS no interviene**. La seguridad la resuelve el JWT de la aplicacion.
- Los proyectos gratuitos de Supabase se pausan por inactividad; se reactivan desde el panel.

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
