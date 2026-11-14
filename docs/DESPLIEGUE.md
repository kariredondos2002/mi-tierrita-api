# Despliegue · API

## Piezas

| Pieza | Dónde |
|---|---|
| API | Imagen de contenedor ([Dockerfile](../Dockerfile)) o servicio Node 22 detrás de un proxy HTTPS |
| Base de datos | PostgreSQL 16 gestionado, con respaldos automáticos |
| Aplicación web | Sitio estático ([mi-tierrita-app](https://github.com/kariredondos2002/mi-tierrita-app)) |

## Pasos

1. **Base:** crea un PostgreSQL 16 y copia su URI (`postgres://usuario:clave@host:puerto/base`).
2. **API:** construye con `corepack enable && pnpm install --frozen-lockfile && pnpm build` y arranca con
   `pnpm db:migrate:prod && pnpm start` (puerto `4300`).
3. **Datos iniciales:** la primera vez, `pnpm create-admin` o, para la demostración, `pnpm db:seed:prod`
   (o `SEED_ON_START=true` una sola vez).
4. **Aplicación:** publica el build de la app con `VITE_API_URL=https://<api>/api/v1`.
5. **CORS:** agrega el dominio de la app a `CORS_ORIGINS` y reinicia la API.

## Variables de entorno en producción

| Variable | Valor |
|---|---|
| `NODE_ENV` | `production` |
| `PORT` | `4300` |
| `DATABASE_URL` | URI de la base (tiene prioridad sobre `DB_*`) |
| `DB_SSL` | `require` (o `verify` si el proveedor da certificado) |
| `JWT_SECRET` | 32 caracteres o más, aleatorio; nunca en el repositorio |
| `JWT_EXPIRES_IN` | `8h` |
| `CORS_ORIGINS` | dominio(s) de la aplicación, separados por coma |
| `BUSINESS_TZ` | `America/Bogota` |
| `ANTHROPIC_API_KEY` | Opcional: activa a Tita |
| `VAPID_PUBLIC_KEY` · `VAPID_PRIVATE_KEY` · `VAPID_SUBJECT` | Opcionales: activan Web Push (`pnpm vapid`) |

## Reiniciar los datos en producción

Para cambiar el conjunto de datos, se pone una vez `RESET_DATA_CONFIRM=<marca>` y se arranca con
`pnpm db:reset:prod && pnpm db:seed:prod && pnpm start`; después se quitan la variable y los dos comandos. Detalle en la
sección «Reinicio de datos» del README.

## Verificación

- `GET /api/v1/health` responde 200.
- `GET /docs` muestra Swagger UI.
- La app inicia sesión y el Inicio carga indicadores.
- El chat recibe mensajes en vivo (`GET /chat/stream`).

## Integración continua

[.github/workflows/ci.yml](../.github/workflows/ci.yml) hace typecheck, pruebas, migraciones contra un PostgreSQL
efímero, build y la imagen de contenedor.
