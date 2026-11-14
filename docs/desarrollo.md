# Desarrollo · API

## Entorno local

Requisitos: Node.js 22 (ver `.nvmrc`), pnpm 10 y Docker (o un PostgreSQL 16 propio).

```bash
pnpm install
cp .env.example .env            # completa JWT_SECRET (mínimo 32 caracteres)
docker compose up -d db         # PostgreSQL 16 en localhost:5433
pnpm db:migrate
pnpm db:seed                    # datos de ejemplo (ver datos-de-prueba.md)
pnpm dev                        # http://localhost:4300/api/v1 · Swagger en /docs
```

## Scripts

| Comando | Qué hace |
|---|---|
| `pnpm dev` | Servidor con recarga (`tsx watch`) |
| `pnpm build` / `pnpm start` | Compila a `build/` y ejecuta |
| `pnpm typecheck` | `tsc --noEmit` |
| `pnpm test` | Pruebas con `node:test` (sin base de datos ni clave de IA) |
| `pnpm db:migrate` / `pnpm db:status` | Aplica o lista las migraciones |
| `pnpm db:seed` / `pnpm db:seed:prod` | Datos de ejemplo idempotentes (desde `src/` o desde `build/`) |
| `pnpm db:reset` / `pnpm db:reset:prod` | Vacía las tablas de negocio con una marca de un solo uso |
| `pnpm create-admin <usuario> <clave>` | Crea el primer administrador |
| `pnpm vapid` | Genera el par de claves de Web Push |

## Reglas del código

1. **Capas con un solo motivo de cambio:** `routes/` cablea ruta, rol y controlador; `controllers/` solo HTTP;
   `business-logic/` dominio y SQL (nunca importa Express); `data-sources/` pool, transacciones y errores de
   PostgreSQL; `models/` tipos, `toXResponse` y `parseX`. Un archivo por operación y barrels por carpeta.
2. **Toda ruta nace protegida:** se monta después de `authenticate` y restringe con `authorize(...)`. La identidad sale
   de `requireAuth(req)`, nunca del cuerpo.
3. **Errores solo por código:** `throw domainError(ErrorCodes.X)`; los códigos nuevos van en `common/errors.ts` y en la
   tabla del README.
4. **Auditoría intocable:** la registra el middleware; las rutas no la duplican ni registran contraseñas.
5. **Esquema solo por migraciones** numeradas con encabezado «qué cambia / por qué»; una migración aplicada no se edita.
6. **Dinero en `DECIMAL(12,2)`;** el módulo financiero usa `DOUBLE PRECISION`. Los totales los calcula el servidor.
7. **Contadores denormalizados** (`products.stock`, `customers.balance`) en la misma transacción, con `SELECT ... FOR UPDATE`.
8. **Listados** `{ count, page, pages, items }` con `parsePageRequest`/`toPageResponse`.
9. **Sin clases en el dominio:** funciones flecha exportadas. Para una entidad nueva, copiar el módulo `categories`.

## Ramas y commits

| Rama | Uso |
|---|---|
| `main` | Versión estable; es la que se despliega |
| `wip/AAAA-MM-DD` | Trabajo en curso guardado sin terminar; no se fusiona a `main` sin revisar |

Los mensajes de commit van en español y dicen qué cambia y para qué (por ejemplo, «Reportes: diagrama del proceso y un
gráfico por cálculo»).

## Definición de «terminado»

- `pnpm typecheck` y `pnpm test` pasan.
- Las migraciones nuevas se aplican limpias sobre una base vacía (`pnpm db:migrate`).
- `docs/openapi.yaml`, la tabla «Estado de la API» del README y el CHANGELOG están al día.
