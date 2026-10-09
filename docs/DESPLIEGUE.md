# Despliegue de Mi Tierrita SIG en Seenode

Tres piezas en el mismo *workspace* de Seenode: la base PostgreSQL, la API (web service) y la aplicación
(static site). Orden: **base → API → aplicación → ajustar CORS**.

## 1. Base de datos

1. Pestaña **Database → Create database**. Tipo **PostgreSQL**, versión **16.14** (la misma de desarrollo; 18.4 también funciona).
2. En la pestaña de conexión copie la **URI** (`postgres://usuario:clave@host:puerto/base`).
3. Para la API use el host de la **red privada** (mismo workspace). Si Seenode solo muestra el host público, sirve igual.

## 2. API (web service)

Los dos repositorios son **privados**: al crear cada servicio, Seenode pide conectar la cuenta de GitHub
`kariredondos2002` y elegir a qué repositorios puede acceder; marque `mi-tierrita-api` y `mi-tierrita-app`.

| Campo | Valor |
|---|---|
| Repositorio | `kariredondos2002/mi-tierrita-api`, rama `main` |
| Build command | `corepack enable && pnpm install --frozen-lockfile && pnpm build` |
| Start command | `pnpm start:seenode` |
| Port | `4300` |

`pnpm start:seenode` aplica las migraciones pendientes, siembra la demo si se pide y arranca el servidor
(`node build/scripts/migrate.js apply && node build/scripts/seed-demo.js && node build/server/index.js`).

Variables de entorno:

| Variable | Valor |
|---|---|
| `NODE_ENV` | `production` |
| `PORT` | `4300` (igual al campo *Port*) |
| `DATABASE_URL` | la URI del paso 1 |
| `DB_SSL` | `require` (si la conexión privada no acepta TLS, use `disable`) |
| `JWT_SECRET` | 32 caracteres o más, aleatorio (por ejemplo, el resultado de `openssl rand -hex 32`) |
| `JWT_EXPIRES_IN` | `8h` |
| `CORS_ORIGINS` | la URL del sitio estático del paso 3 (se completa después) |
| `SEED_DEMO` | `true` para la sustentación (siembra 120 días de datos simulados solo si la base está vacía); `false` para un negocio real |

Verificación: `https://<api>/health` responde `{"status":"ok","database":"up"}` y `https://<api>/docs` muestra Swagger.

## 3. Aplicación (static site)

| Campo | Valor |
|---|---|
| Repositorio | `kariredondos2002/mi-tierrita-app`, rama `main` |
| Build command | `corepack enable && pnpm install --frozen-lockfile && pnpm build` |
| Publish directory | `dist` |
| Client-side routing | activado |
| `VITE_API_URL` | `https://<api>/api/v1` |
| `VITE_SHOW_DEMO_ACCOUNTS` | `true` durante la sustentación |

## 4. Cerrar el circuito

1. Copie la URL pública del sitio estático en `CORS_ORIGINS` de la API y redepliegue la API.
2. Entre con `admin` / `MiTierrita2026` y recorra Tablero, Inventario, Ventas y Evaluación financiera.
3. Active **auto-deploy** en ambos servicios: cada `git push` a `main` publica la nueva versión.
4. Copie las dos URL en el anexo de cada TCC y en Notion.

## Problemas frecuentes

| Síntoma | Causa y arreglo |
|---|---|
| La API no arranca: «Falta la variable de entorno obligatoria …» | Falta `JWT_SECRET` o `DATABASE_URL` |
| `self-signed certificate` o `SSL` al conectar | Use `DB_SSL=require` (no verifica la CA) |
| `The server does not support SSL connections` | Use `DB_SSL=disable` (red privada) |
| La aplicación muestra «No se pudo conectar» | `VITE_API_URL` mal escrita (requiere `/api/v1`) o `CORS_ORIGINS` sin la URL del sitio; recuerde que `VITE_*` se fija al compilar: redepliegue el sitio |
| Al refrescar una ruta sale 404 | Active *client-side routing* en el sitio estático |
