# UNIVERSIDAD DE CARTAGENA
## Ingeniería de Software · Sistemas de Información Gerencial (AL17705) · Ingeniería Económica (FC17701)
### Trabajo Colaborativo Contextualizado · 2026-2

---

# Mi Tierrita SIG · API
## Sistema de Información Gerencial y de apoyo a la decisión para Agropecuaria Mi Tierrita

![Node.js](https://img.shields.io/badge/Node.js-22-339933?logo=node.js&logoColor=white)
![Express](https://img.shields.io/badge/Express-5-000000?logo=express)
![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-4169E1?logo=postgresql&logoColor=white)
![JWT](https://img.shields.io/badge/Auth-JWT%20%2B%20bcrypt-orange)
![OpenAPI](https://img.shields.io/badge/OpenAPI-3.1-6BA539?logo=openapiinitiative&logoColor=white)
![Migraciones](https://img.shields.io/badge/Migraciones-0001%E2%80%930018-2F9E5B)
![Licencia](https://img.shields.io/badge/Licencia-Académica-lightgrey)

Servidor de **Mi Tierrita SIG**: API REST + avisos en tiempo real (Server-Sent Events) + persistencia en PostgreSQL.
Lo consume la aplicación web [`mi-tierrita-app`](https://github.com/kariredondos2002/mi-tierrita-app).

**Demostración:** aplicación web en [mi-tierrita-app-keoc.vercel.app](https://mi-tierrita-app-keoc.vercel.app) (Vercel, datos de ejemplo).

**Enlaces:** [presentación (Figma Slides)](https://www.figma.com/deck/0bH9C8DbFsVHskGEeIQPIW/PRESENTACI%C3%93N-Mi-Tierrita-SIG?node-id=0-20) · [repositorio del cliente](https://github.com/kariredondos2002/mi-tierrita-app) · [contrato OpenAPI](docs/openapi.yaml) · [todos los enlaces](docs/ENLACES.md) · [cuentas de prueba](docs/datos-de-prueba.md)

---

## Arranque rápido

Requisitos: Node.js 22, pnpm y PostgreSQL 16 (o Docker para levantar la base). Detalle en
[Instalación y Ejecución](#instalación-y-ejecución).

```bash
pnpm install
cp .env.example .env            # completa JWT_SECRET (mínimo 32 caracteres)
docker compose up -d db         # PostgreSQL 16 en localhost:5433
pnpm db:migrate && pnpm db:seed # esquema y datos de ejemplo
pnpm dev                        # http://localhost:4300/api/v1 · documentación en /docs
```

Cuentas para entrar: ver [Datos de ejemplo](#datos-de-ejemplo). La interfaz está en
[`mi-tierrita-app`](https://github.com/kariredondos2002/mi-tierrita-app). Para Tita (la asistente) el servidor necesita
`ANTHROPIC_API_KEY`; sin ella todo lo demás funciona igual.

## Documentación

| Documento | Contenido |
|---|---|
| [Arquitectura y Diseño](#arquitectura-y-diseño) · [API REST](#api-rest) · [Códigos de error](#códigos-de-error) | Capas, contrato de la API y errores (en este README) |
| [docs/README.md](docs/README.md) | Índice de la documentación y orden de lectura según tu rol |
| [docs/desarrollo.md](docs/desarrollo.md) | Entorno local, scripts, reglas del código, ramas y definición de «terminado» |
| [docs/datos-de-prueba.md](docs/datos-de-prueba.md) | Cuentas demo por rol, qué probar con cada una y cómo reiniciar los datos |
| [docs/DESPLIEGUE.md](docs/DESPLIEGUE.md) | Contenedor, base gestionada, variables y verificación en producción |
| [docs/openapi.yaml](docs/openapi.yaml) | Contrato OpenAPI 3.1 de todos los endpoints; servido con Swagger UI en `/docs` |
| [docs/ENLACES.md](docs/ENLACES.md) | Repositorios, demostración, presentación, diseño, manuales por rol (Figma) y diagramas |
| [migrations/](migrations) | Esquema de la base en SQL numerado (0001 a 0018) |
| [CHANGELOG.md](CHANGELOG.md) | Historial de cambios |
| [LICENSE](LICENSE) | Licencia del código |

---

## Tabla de Contenidos

0. [Arranque rápido](#arranque-rápido) · [Documentación](#documentación)
1. [Descripción](#descripción)
2. [Marco Teórico](#marco-teórico)
3. [Funcionalidades](#funcionalidades)
4. [Roles y Permisos](#roles-y-permisos)
5. [Arquitectura y Diseño](#arquitectura-y-diseño)
6. [Tecnologías](#tecnologías)
7. [Instalación y Ejecución](#instalación-y-ejecución)
8. [Variables de Entorno](#variables-de-entorno)
9. [Datos de ejemplo](#datos-de-ejemplo)
10. [Base de Datos](#base-de-datos)
11. [API REST](#api-rest)
12. [Reglas de Negocio](#reglas-de-negocio)
13. [Códigos de error](#códigos-de-error)
14. [Seguridad](#seguridad)
15. [Pruebas](#pruebas)
16. [Despliegue](#despliegue)
17. [Solución de Problemas](#solución-de-problemas)
18. [Decisiones pendientes con el negocio](#decisiones-pendientes-con-el-negocio)
19. [Fases del Desarrollo](#fases-del-desarrollo)
20. [Autores](#autores)
21. [Notas Académicas](#notas-académicas)
22. [Licencias](#licencias)

---

## Descripción

Backend REST de **Mi Tierrita SIG**, el sistema de información gerencial de **Agropecuaria Mi Tierrita**, una tienda
agropecuaria de Sahagún (Córdoba). Reúne en un solo lugar lo que la tienda llevaba en cuadernos y hojas sueltas:
inventario con **lotes y vencimientos (FEFO)**, punto de venta, clientes con **cupo y cartera**, proveedores, pedidos,
conteos de inventario, nómina simplificada, usuarios y roles, auditoría, reportes con folio verificable, el
**simulador financiero** de la ampliación del local, chat del equipo, alarmas, contactos de la página pública y **Tita**,
la asistente con IA (Claude, de Anthropic).

Este repositorio implementa la documentación técnica del Trabajo Colaborativo Contextualizado: arquitectura del
backend (01), requisitos (03), casos de uso (04), modelo de datos (05), diseño de la API (06) e infraestructura del
backend (08). Sustenta dos trabajos del semestre: **Sistemas de Información Gerencial** (ERP + BI + DSS para la gerencia)
e **Ingeniería Económica** (evaluación con VPN, TIR y sensibilidad de financiar con crédito la ampliación).

---

## Marco Teórico

### Sistema de información gerencial (ERP + BI + DSS)

| Capa | Qué resuelve en Mi Tierrita | Dónde vive |
|---|---|---|
| ERP (operación) | Registrar ventas, compras, lotes, cartera, pedidos, conteos y nómina sin perder datos | `business-logic/` de cada entidad |
| BI (inteligencia de negocios) | Reportes de ventas, inventario y cartera agregados en SQL, indicadores del Inicio | `business-logic/reports/`, `GET /reports/*` |
| DSS (apoyo a la decisión) | ¿Conviene financiar con crédito la ampliación? VPN, TIR, B/C, recuperación, tornado y escenarios | `business-logic/financial/simulator.ts` |

### Arquitectura por capas

Cada petición recorre `routes` → `controllers` → `business-logic` → `data-sources` → PostgreSQL, y ninguna capa se
salta a otra. Así una regla de negocio (FEFO, cupo de crédito, anulación) vive en un solo archivo y la usan por igual la
app, los reportes y Tita.

### Autenticación sin estado con JWT

Al iniciar sesión el servidor firma un token (HS256) con el usuario, su rol y su versión de token. Cada petición lo
envía en la cabecera `Authorization`; cerrar sesión sube la versión y deja inválidos los tokens anteriores sin
guardar sesiones en memoria.

### Tiempo real con Server-Sent Events

El chat, las alarmas y los avisos llegan por `GET /chat/stream`, una conexión HTTP que el servidor mantiene abierta y
por la que empuja eventos. El aviso no trae datos sensibles: la app los pide por REST. Entre instancias los eventos
viajan con `LISTEN/NOTIFY` de PostgreSQL.

### Inventario FEFO

*First Expired, First Out*: cada venta descuenta del lote que vence primero y salta los lotes vencidos. Reduce
pérdidas por vencimiento, que en una agropecuaria (medicina veterinaria, concentrados, semillas) son dinero perdido.

### Evaluación financiera

El simulador proyecta a cinco años la demanda, la cuota de mercado, los costos, la inversión, el crédito (sistema
francés) y el flujo de caja libre; descuenta los flujos a la tasa mínima exigida para obtener VPN, TIR, relación
beneficio/costo y período de recuperación, y mide el riesgo con un análisis de sensibilidad (tornado) y escenarios.

---

## Funcionalidades

| Módulo | Qué hace |
|---|---|
| Autenticación y usuarios | Inicio y cierre de sesión con JWT, perfil propio, foto de perfil, cambio de contraseña, directorio de personas con presencia |
| Inventario y lotes | Productos, categorías (líneas públicas), lotes con vencimiento, stock físico y vendible |
| Ventas | Punto de venta de contado y a crédito con FEFO, precio congelado, factura correlativa y anulación |
| Clientes y cartera | Cupo de crédito, saldo, abonos y cartera vencida |
| Proveedores y pedidos | Compras con lote, pedidos a proveedores y de clientes, recepciones parciales y entregas |
| Conteos de inventario | Programar, contar, enviar y aplicar ajustes por FEFO |
| Nómina | Liquidación simplificada por periodos (borrador, aprobado, pagado) |
| Simulador financiero | Mercado, competencia, costos, inversión, financiación, flujo de caja, riesgos y proyectos guardados |
| Reportes | Ventas, inventario, cartera e informe del proyecto con folio, huella y verificación pública por QR |
| Comunicación | Chat general y privado con hilos, acuses, fijados, adjuntos y notas de voz; comentarios por registro |
| Alarmas y avisos | Alarmas personales, avisos de vencimiento, calendario y Web Push |
| Tita | Consultas y acciones con confirmación, recomendaciones del día, borradores y lectura de facturas |
| Auditoría | Registro automático de cada escritura, con la marca «IA» cuando la sugirió Tita |

El detalle de cada endpoint está en [API REST](#api-rest).

---

## Roles y Permisos

| Rol (API) | Nombre en la app | Puede |
|---|---|---|
| `ADMIN` | Administrador | Todo: los 18 módulos, finanzas, nómina, usuarios, auditoría, anulaciones y ajustes de conteo |
| `SALES` | Secretaria | Ventas, clientes y cartera, pedidos de clientes, reporte de ventas, inventario en consulta, chat, Tita y alarmas |
| `WAREHOUSE` | Bodega | Inventario, lotes, proveedores y compras, pedidos a proveedores, conteos, chat, Tita y alarmas |

No hay registro público: el primer administrador se crea con `pnpm create-admin` y él crea las demás cuentas. Cada ruta
declara sus roles con `authorize(...)`; un rol sin permiso recibe `613` con `requiredRoles`.

---

## Arquitectura y Diseño

API REST en **arquitectura por capas**. Una petición entra por `routes/`, pasa a `business-logic/`
y esta usa `data-sources/` para hablar con PostgreSQL. Ninguna capa se salta a otra.

```
src/
  server/          arranque, configuración, manejador de errores, middleware de auditoría
  security/        roles, bcrypt, JWT, middleware de autenticación, matriz de autorización
  routes/          un archivo por entidad: cablea cada ruta con su rol permitido y su controlador
  controllers/     capa de presentación: un archivo por operación; valida la entrada, llama a la
                   lógica y traduce a respuesta HTTP (solo entiende de HTTP)
  business-logic/  reglas del dominio y SQL: un archivo por operación, agrupadas por entidad
                   (ai/: Tita — herramientas de consulta y de acción, recomendaciones, borradores, facturas)
  models/          forma de las filas, DTOs de entrada/salida y funciones parseX() de validación
  data-sources/    pool de conexiones a PostgreSQL, transacciones y traducción de errores de la base
  common/          códigos de error, paginación, validador, fechas
  scripts/         migrador y creación del primer administrador
migrations/        SQL numerado y versionado
docs/openapi.yaml  contrato público de la API (todos los endpoints)
tests/             pruebas unitarias (validación, errores, paginación, token, motor financiero, auditoría,
                   permisos y adjuntos de Tita)
```

Una petición recorre `routes` → `controllers` → `business-logic` → `data-sources` (pool) → PostgreSQL.

### Reglas que se cumplen en todo el código

1. **Toda ruta nace protegida.** En [src/routes/index.ts](src/routes/index.ts) solo `POST /auth/signin`
   se monta antes del middleware `authenticate`; todo lo demás exige token y restringe por rol con
   `authorize(...)`. La identidad sale siempre de `requireAuth(req)`, nunca del body.
2. **El dato guardado nunca cruza la frontera HTTP.** Cada entidad tiene su `toXResponse`; la
   contraseña y la versión de token jamás salen en una respuesta.
3. **Errores como código de dominio.** La lógica lanza `domainError(ErrorCodes.X)` y el manejador
   único responde `{ "message": "<código>" }` con el estado HTTP correspondiente. Nunca un stack trace.
4. **Auditoría automática.** El middleware registra cada escritura exitosa (usuario, método, recurso,
   fecha y, con la cabecera `X-AI-Suggested: 1`, la marca `ai_suggested`); las rutas no auditan por su cuenta.
5. **Listados uniformes.** `?page=` (base 1) y `?limit=` (10, máximo 100) responden
   `{ count, page, pages, items }`.
6. **Los cálculos importantes los hace el servidor.** Totales de venta e indicadores financieros que
   lleguen del cliente se ignoran y se recalculan.
7. **Sin clases en el dominio:** funciones flecha exportadas, un archivo por operación y barrels por carpeta.
8. `snake_case` en la base, `camelCase` en TypeScript y en el JSON de la API (los SELECT hacen el alias).
9. **Contadores denormalizados con bloqueo.** `products.stock` y `customers.balance` se mueven en la misma
   transacción que la operación que los cambia, con `SELECT ... FOR UPDATE` sobre la fila (RNF-04).

### Cómo agregar una entidad

Replica el módulo `categories` (el más pequeño): `models/<entidad>.ts` (tipos + `parseX`) →
`business-logic/<entidad>/<operacion>.ts` (reglas + SQL) → `controllers/<entidad>/<operacion>.ts` →
`routes/<entidad>.ts` con su `authorize(...)` → montar en `routes/index.ts` después de `authenticate` →
documentar en `docs/openapi.yaml` → migración si cambia el esquema.

---

## Tecnologías

| Componente | Tecnología |
|---|---|
| Framework HTTP | Express 5 (Node.js 22, TypeScript) |
| Base de datos | PostgreSQL 16, cliente `pg` directo (sin ORM) |
| Autenticación | JWT (HS256) + bcrypt |
| Validación | A mano, con el validador de `common/validate.ts` en cada DTO de entrada |
| Esquema de base | Migraciones SQL versionadas en `migrations/` |
| Documentación | OpenAPI 3.1 servido con Swagger UI en `/docs` |
| Pruebas | `node:test` |
| IA | SDK oficial de Anthropic (`@anthropic-ai/sdk`), opcional según `ANTHROPIC_API_KEY` |

---

## Instalación y Ejecución

### Requisitos

| Herramienta | Versión |
|---|---|
| Node.js | 22 (ver `.nvmrc`) |
| pnpm | 10 |
| PostgreSQL | 16 (o Docker con `docker compose`) |

### Pasos

```bash
pnpm install
cp .env.example .env            # ajusta si hace falta
docker compose up -d db         # PostgreSQL 16 en localhost:5433
pnpm db:migrate                 # aplica migrations/*.sql
pnpm create-admin admin 'una-clave-segura'
pnpm db:seed                    # opcional: datos de ejemplo (ver «Datos de ejemplo»)
pnpm dev                        # http://localhost:4300/api/v1 · docs en /docs
```

Comandos:

| Comando | Qué hace |
|---|---|
| `pnpm dev` | Servidor con recarga (`tsx watch`) |
| `pnpm build` / `pnpm start` | Compila a `build/` y ejecuta |
| `pnpm typecheck` | `tsc --noEmit` |
| `pnpm test` | Pruebas unitarias (no necesitan base de datos ni clave de IA) |
| `pnpm db:migrate` / `pnpm db:status` | Aplica o lista migraciones |
| `pnpm create-admin <usuario> <clave>` | Crea el primer ADMIN (no hay registro público) |
| `pnpm db:seed` / `pnpm db:seed:prod` | Datos de ejemplo idempotentes (desde `src/` o desde `build/`) |
| `RESET_DATA_CONFIRM=<marca> pnpm db:reset` / `pnpm db:reset:prod` | Vacía las tablas de negocio y conserva las cuentas; cada marca sirve una sola vez (ver «Reinicio de datos») |
| `docker compose up --build` | API + base de datos en contenedores |

---

## Variables de Entorno

Ningún valor sensible va en el código ni en la imagen. Ver [.env.example](.env.example).

| Variable | Propósito |
|---|---|
| `PORT` | Puerto donde escucha el proceso (4300) |
| `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD` | Conexión a PostgreSQL en local |
| `DATABASE_URL` | Cadena única del Postgres gestionado; si está, sustituye a las cinco anteriores |
| `DB_SSL` | TLS de la conexión: `disable`, `require` o `verify` |
| `JWT_SECRET` | Firma de los tokens; mínimo 32 caracteres, sin valor por defecto |
| `JWT_EXPIRES_IN` | Vigencia del token (`8h`) |
| `ANTHROPIC_API_KEY` | Clave de Claude (Anthropic) para el asistente. Opcional: sin ella las rutas `/ai` responden 660 y la app oculta la IA |
| `AI_MODEL` / `AI_FAST_MODEL` | Modelo del asistente y de los textos cortos (`claude-sonnet-5-5` / `claude-haiku-5-5`) |
| `BUSINESS_TZ` | Zona horaria del negocio para "hoy", cortes de reportes y vencimientos (`America/Bogota`) |
| `CORS_ORIGINS` | Dominios del frontend permitidos, separados por coma |
| `SEED_ON_START` | Con `true`, la API ejecuta el seed de datos de ejemplo al arrancar (apagado por defecto) |
| `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` / `VAPID_SUBJECT` | Par Web Push (`pnpm vapid` lo genera) y contacto `mailto:`. Opcionales: sin el par, el push queda apagado (`/push/subscriptions` responde 673) y las alarmas llegan solo por el stream |

---

## Datos de ejemplo

`pnpm db:seed` (brief de octubre de 2026, punto 39) llena la base con una agropecuaria de Sahagún (Córdoba) usando la
lógica de negocio real (FEFO, stock, cartera, acuses del chat). Es **idempotente**: cada registro se busca por su clave
natural (usuario, SKU, NIT, documento, nombre del escenario, `clientId` del mensaje, instante de la venta) y si ya
existe se deja igual; correrlo dos veces no duplica nada ni toca los datos que no son demo. Tarda unos segundos, no
necesita red ni `ANTHROPIC_API_KEY`, y al final imprime cuántos registros creó u omitió. Con `SEED_ON_START=true` el
servidor lo ejecuta al arrancar, después de `db.ping()`.

### Reinicio de datos

`RESET_DATA_CONFIRM=<marca> pnpm db:reset` (`db:reset:prod` desde `build/`) deja la base lista para volver a sembrar: vacía
en una sola transacción (`TRUNCATE … RESTART IDENTITY CASCADE`) todas las tablas de negocio del esquema `public` y conserva
`users`, `roles`, `schema_migrations` y `data_resets`; si el número de usuarios cambiara, se deshace. Sin la variable no hace
nada, y cada marca se anota en `data_resets` y **solo sirve una vez**: un arranque repetido con la misma variable no vuelve a
borrar. Se escribió el 9/11/2026 para sacar de producción el conjunto de prueba de la etapa anterior (colmado) antes de correr
`pnpm db:seed:prod`; en el servidor se ejecuta una sola vez poniendo la variable y `pnpm db:reset:prod && pnpm db:seed:prod`
delante de `pnpm start`, y después se quitan ambos.

Qué crea y cómo se reconoce (sin columnas nuevas):

| Datos | Cantidad | Marca |
|---|---|---|
| Usuarios `demo.admin` (ADMIN), `demo.caja` (SALES), `demo.bodega` (WAREHOUSE) | 3 | usuario `demo.*`; clave de los tres: `Demo-2026` |
| Líneas de la página pública (Alimentos balanceados, Medicina veterinaria, Semillas y fertilizantes, Aves de corral, Productos agroquímicos, Ferretería agrícola) con descripción y subfamilias | 6 | por `code` 01…06, o por nombre si la base es anterior a la migración 0018 (entonces se les completa el código) |
| Productos con precios de compra y venta | 56 | SKU `DEMO-XXX-NNN` |
| Proveedores | 5 | NIT `DEMO-…` |
| Lotes: lejanos (cubren las ventas), por vencer en 3, 10 y 25 días y ya vencidos | ~78 | producto `DEMO-…` |
| Clientes con cupo: al día, con cartera vencida, con cupo agotado y solo de contado | 28 | documento `DEMO-…` |
| Ventas de contado y a crédito de los últimos 120 días, con anulaciones y abonos | ~180 ventas, ~6 anuladas, ~50 abonos | registradas por `demo.*` |
| Escenarios financieros | 3 | nombre `[Demo] …` |
| Chat del equipo: canal general con hilo, cita y fijado; privados; adjuntos reales (PNG, PDF y CSV generados por el script y guardados en `chat_attachments`) | 34 mensajes, 3 adjuntos | autor `demo.*` |
| Mensajes de contacto del sitio | 3 | correo `@ejemplo.demo` |
| Exportaciones de reportes (historial con folio) | 5 | generadas por `demo.*` |

Las fechas históricas se ajustan con `UPDATE` después de registrar (la lógica fecha con `now()`); el ancla es el día
en que se creó `demo.admin`, así que al volver a correrlo otro día no aparecen ventas nuevas. Las listas viven en
`src/scripts/seed-data.ts` (funciones puras, probadas en `tests/seed.test.ts`) y la ejecución en `src/scripts/seed.ts`.

---

## Base de Datos

PostgreSQL 16 con **39 tablas de negocio** creadas por las migraciones `0001` a `0018` de [migrations/](migrations)
(más `schema_migrations`, que lleva el control de las aplicadas, y `data_resets`, que anota los reinicios de datos).

| Grupo | Tablas |
|---|---|
| Usuarios y catálogo | `roles`, `users`, `categories`, `products`, `suppliers`, `product_batches` |
| Ventas y cartera | `customers`, `sales`, `sale_lines`, `sale_line_batch_allocations`, `customer_payments`, `invoice_counters` |
| Pedidos y conteos | `orders`, `order_lines`, `stock_counts`, `stock_count_lines`, `stock_count_adjustments` |
| Chat interno | `chat_messages`, `chat_receipts`, `chat_mentions`, `chat_attachments` |
| Tita | `ai_conversations`, `ai_messages` |
| Alarmas y avisos | `alarms`, `alarm_fires`, `due_notices`, `push_subscriptions` |
| Nómina | `payroll_employees`, `payroll_periods`, `payroll_lines` |
| Simulador financiero | `financial_projects`, `financial_scenarios`, `financial_scenario_cash_flows`, `financial_scenario_amortization` |
| Auditoría, reportes y otros | `audits`, `record_comments`, `report_exports`, `library_items`, `contact_messages` |

### Reglas de integridad

- El esquema solo cambia por migraciones numeradas; una migración aplicada no se edita.
- Dinero del negocio en `DECIMAL(12,2)`; el módulo financiero usa `DOUBLE PRECISION`.
- `products.stock` y `customers.balance` se mueven en la misma transacción que la operación que los cambia, con
  `SELECT ... FOR UPDATE` sobre la fila.
- `snake_case` en la base y `camelCase` en el JSON de la API.

### Comandos útiles

```bash
pnpm db:migrate      # aplica las migraciones pendientes
pnpm db:status       # lista las aplicadas y las pendientes
pnpm db:seed         # datos de ejemplo (idempotente)
```

---

## API REST

Prefijo: `/api/v1`. Todas las rutas, salvo `POST /auth/signin` y las públicas indicadas, exigen
`Authorization: Bearer <token>`. Contrato completo en [docs/openapi.yaml](docs/openapi.yaml) y en `/docs`.

Los 44 endpoints del documento 06 están implementados y documentados en `/docs`. Las migraciones
`0002_figma_v4` y `0003_chat_privado_presencia` agregan 9 más que pide el prototipo de escritorio v4.2 (Mi perfil,
historial de reportes, chat del equipo con privados y presencia, y contactos del sitio), `0004_auditoria_sugerido_ia`
acompaña las 5 rutas de Tita (`/ai`) `0005_chat_acuses_hilos_adjuntos` amplía el chat con 11 rutas más (acuses,
hilos, fijados, búsqueda, adjuntos y avisos en vivo), `0006_chat_editar_eliminar` agrega 2 (editar y eliminar) y `0007_tita_conversaciones`
agrega 5 (respuesta en dos pasos e historial de Tita) y `0008_alarmas_avisos_push` agrega 12 (alarmas, avisos de vencimiento y Web Push). Ninguno estaba en el documento 06; quedan registrados aquí.

| Módulo | Endpoints | Casos de uso |
|---|---|---|
| Salud y documentación | `GET /health`, `GET /docs`, `GET /docs/openapi.json` | — |
| Autenticación | `POST /auth/signin`, `POST /auth/signout`, `GET /auth/me` | CU-01, CU-02 |
| Usuarios | `POST/GET /users`, `GET /users/:id`, `PUT /users/me/password`, `PUT /users/me` (perfil propio), `PUT /users/me/avatar` (foto propia: binario JPEG/PNG/WebP ≤ 1 MB, la app la reduce a 256×256), `DELETE /users/me/avatar`, `GET /users/:id/avatar` (cualquier rol; 691 si no tiene; `Cache-Control: private, max-age=300` y `ETag` por `avatarUpdatedAt`). `GET /users/directory` (cualquier rol; brief 2.5, punto 30): directorio de personas con `id`, nombre, `username`, `role`, `email`, `phone`, `hasAvatar`, `avatarUpdatedAt`, `online` y `lastSeenAt` (misma regla de presencia del chat: petición en los últimos 90 s sin cierre de sesión posterior) y `active`; las cuentas inactivas solo las ve ADMIN, marcadas. Toda respuesta de usuario (incluido `GET /auth/me`) trae `hasAvatar` y `avatarUpdatedAt` | CU-03, CU-04, prototipo 15, brief 2.5 (34) |
| Categorías | `POST/GET /categories`, `PUT/DELETE /categories/:id` (desde la migración `0018_lineas_publicas` cada categoría trae `code`, `description` y `tags`; `POST` y `PUT` aceptan `description` y `tags`; el listado va por código y luego por nombre), `GET /categories/public` (**público**, 60 por minuto por IP, `Cache-Control` 5 min: las categorías activas con código, solo `code`, `name`, `description`, `tags`; lo lee la página pública para que sus líneas sean las mismas del inventario). Las seis líneas iniciales viven en `business-logic/categories/product-lines.ts`; la fuente en ejecución es la tabla. `GET /categories/public` no estaba en el documento 06 | — / extensión |
| Productos e inventario | `POST/GET /products`, `GET/PUT/DELETE /products/:id`, `POST/GET /products/:id/batches`, `GET /batches/expiring` | CU-05, CU-06, CU-07 |
| Ventas | `POST/GET /sales`, `GET /sales/:id`, `POST /sales/:id/void` | CU-08 (FEFO), CU-09, CU-10, CU-11, RF-03.4 |
| Clientes y cartera | `POST/GET /customers`, `GET/PUT /customers/:id`, `GET /customers/:id/balance`, `POST /customers/:id/payments` | CU-12 |
| Proveedores | `POST/GET /suppliers`, `PUT /suppliers/:id`, `POST /suppliers/:id/purchases` | CU-13 |
| Finanzas (capítulo 5) | `POST/GET /financial/scenarios`, `GET .../compare`, `GET .../:id`, `.../amortization`, `.../sensitivity`, `.../sensitivity/bivariate`, `.../tornado`. Desde la Fase B la app ya no los muestra: siguen como respaldo del capítulo 5 del TCC | CU-14 a CU-17 |
| Simulador financiero (0017) | ADMIN. `GET /financial/simulator/defaults` (ejemplo de $94,5 M y su cálculo), `POST /financial/simulator/calculate` (`{ input }` → `{ input, result }`, sin guardar), `GET /financial/projects` (los propios; `?alcance=todos`), `POST /financial/projects` («Guardar como», `{ name, input }`), `GET .../compare?ids=`, `GET/PUT/DELETE /financial/projects/:id` (PUT = «Guardar proyecto»; PUT y DELETE solo el dueño, 716). Se guarda solo `input`; las cifras las recalcula `simulator.ts` en cada lectura. `result.investment` trae por separado la depreciación de activos fijos y la amortización de diferidos (`schedule`, `annualDepreciation`, `annualAmortization`, `depreciationTotal`, `amortizationTotal`; 5/11/2026). Módulo nuevo: no estaba en el documento 06 | Brief, sección 3 |
| Auditoría | `GET /audits` (desde 0011 cada fila trae `entity`, `entityId` y `changes`: el registro tocado y qué cambió, que el middleware deduce de la ruta, del cuerpo de la petición —sin contraseñas, adjuntos, base64 ni textos de más de 2000 caracteres— y de un resumen escalar de la respuesta), `GET /audits/entity/:entity/:id` (ADMIN; línea de tiempo de un registro: quién, cuándo, método y `changes`) | CU-18, brief 2.5 (33) |
| Búsqueda | `GET /search?q=` (todos los roles; mínimo 2 caracteres; sin tildes ni mayúsculas; hasta 6 por grupo y solo los grupos que el rol puede ver: `products` y `people` todos, `customers` ADMIN y SALES, `suppliers` ADMIN y WAREHOUSE; las personas salen sin correo ni teléfono) | brief 2.5 (29) |
| Comentarios | `GET /comments?entity=&entityId=`, `POST /comments` (`entity` products/customers/sales/suppliers/batches, `entityId`, `body` hasta 1000, `replyToId` opcional; todos los roles, pero cada rol solo comenta los registros que puede ver: 613 si no), `DELETE /comments/:id` (el autor o ADMIN; borrado lógico). Cada comentario trae `author` y `replyTo { id, author, excerpt, deleted }` | brief 2.5 (33) |
| Reportes | `GET /reports/sales` (incluye `averageTicket`; por día cada fila trae `cashTotal`, `creditTotal`, `sourceIds` (hasta 20 ids de venta) y `sourceCount`; por producto `sourceIds` y `sourceCount`), `GET /reports/inventory` (`byCategory[].productIds`, hasta 20), `GET /reports/receivables`, `GET/POST /reports/exports` (historial de documentos generados: `POST` acepta `filters` y `summary` —objetos planos de escalares— y devuelve `folio` `R-AAAA-NNNNNN`, `hash` sha256 de `report|format|filters|summary|createdAt|userId` y `verifyUrl`), `GET /reports/verify/:folio` (público, 30 por minuto por IP: datos de emisión del documento del QR; 680 si no existe) | CU-19, CU-20, prototipo 09, brief 2.4 |
| Chat del equipo | `GET/POST /chat/messages` (canal general o privado con `?with=` / `recipientId`; hilo con `?thread=` / `threadRootId`; cita con `replyToId`; `?after=`, `?before=` y `?around=` para lo nuevo, el historial o saltar a un mensaje; `clientId` evita duplicados), `PATCH /chat/messages/:id` (editar, solo el autor), `DELETE /chat/messages/:id` (eliminar: el autor; en #general también ADMIN), `GET /chat/messages/state?ids=`, `GET /chat/messages/:id/receipts` (solo el autor; con `playedAt` y la lista `played` en notas de voz), `POST /chat/messages/:id/played` (reproduje la nota de voz: mensaje ajeno con audio), `PUT/DELETE /chat/messages/:id/pin`, `GET /chat/pins`, `GET /chat/media?kind=image|file|audio|link` (contenido de la conversación, paginado), `POST /chat/read`, `GET /chat/search` (`q` y/o `day=YYYY-MM-DD`), `POST /chat/attachments` (binario, 10 MB; notas de voz WebM/Ogg/MP4/MPEG con `X-Duration-Ms`), `GET /chat/attachments/:id`, `GET /chat/stream` (avisos en vivo, SSE), `GET /chat/team` (en línea, no leídos, menciones) | prototipo 11 + extensión |
| Tita (asistente de IA) | `GET /ai/status`, `GET /ai/briefing` (recomendaciones del rol + párrafo de IA), `POST /ai/chat` (herramientas de consulta y de acción con los permisos del rol; acepta adjuntos: imagen, PDF o texto; hasta 24 MB; con `asincrono: true` responde 202 `{ tareaId, conversationId }` y la respuesta se recoge en `GET /ai/mensajes/:tareaId` —202 mientras trabaja, 200 con la respuesta—; `conversationId` y `screen` opcionales), `PATCH /chat/messages/:id/tita-actions` y `PATCH /comments/:id/tita-actions` (mención **@Tita** en el chat del equipo o en un comentario: Tita responde ahí mismo, a nombre de quien la mencionó y con sus herramientas; solo esa persona confirma o descarta las tarjetas), `POST /ai/complete` (continuación sugerida de la pregunta con el modelo rápido; tope 40/min), `GET /ai/conversations`, `GET/DELETE /ai/conversations/:id`, `POST /ai/conversations/:id/events` (historial propio de conversaciones: la API guarda cada pregunta y respuesta; los adjuntos solo por nombre), `POST /ai/drafts`, `POST /ai/invoice` (ADMIN, WAREHOUSE). Las herramientas de acción no escriben: validan con el mismo `parseX` del endpoint y devuelven la petición exacta; la app la ejecuta contra el endpoint real solo si la persona confirma, con `X-AI-Suggested: 1` (auditoría `ai_suggested`). No crea usuarios ni maneja contraseñas. Tope de 40 consultas cada 5 min por persona; las rutas `/ai` no se auditan porque no escriben. La búsqueda de clientes y productos ignora tildes y mayúsculas | extensión |
| Biblioteca | `GET /library?kind=document\|link&q=&page&limit` (cualquier rol; solo los ítems cuyo `roles` esté vacío o incluya el del solicitante), `POST /library/links` (ADMIN: `title`, `description`, `url` http(s), `roles`), `POST /library/documents` (ADMIN: binario ≤ 10 MB con los mismos tipos que los adjuntos del chat salvo audio; `X-File-Name`, `X-Title`, `X-Description`, `X-Roles` codificados con encodeURIComponent), `PUT /library/:id` (ADMIN: título, descripción, roles y, en enlaces, `url`), `DELETE /library/:id` (ADMIN), `GET /library/:id/file` (quien pueda verlo; imágenes, PDF y texto en línea, el resto como descarga) | brief 2.5 (35) |
| Contactos del sitio | `POST /contact` (público, 5 por hora por IP, campo trampa `website`), `GET /contact-messages`, `PATCH /contact-messages/:id` | prototipo 12 |
| Alarmas y avisos | `GET /alarms?status=upcoming\|past` (propias; `past` lista los disparos), `POST /alarms`, `GET/PUT/DELETE /alarms/:id`, `PATCH /alarms/:id/active`, `GET /alarms/:id/ics` y `GET /alarms/ics` (`text/calendar`, RRULE según repetición, `TZID` America/Bogota). Planificador en el proceso (`business-logic/alarms/scheduler.ts`): cada minuto, con bloqueo consultivo, dispara las alarmas vencidas, recalcula el próximo disparo (`nextFireAt`, hora de Colombia), guarda `alarm_fires`, publica el evento en vivo `alarm` por `GET /chat/stream` y envía Web Push. `GET /notifications/due`: lotes vencidos o por vencer (7 días; ADMIN y WAREHOUSE) y cartera vencida o a 5 días de vencer (ADMIN y SALES), con la misma regla del reporte de cartera; a las 07:00 el planificador publica a cada persona el evento `due` y un push con su resumen (una vez al día, `due_notices`). También avisa pedidos atrasados o a 2 días (`order_overdue`, `order_due_soon`; cada rol solo los tipos que maneja), nómina por pagar desde 3 días antes (`payroll_due`, solo ADMIN) y conteos atrasados o de hoy y mañana (`count_overdue`, `count_due`; ADMIN y WAREHOUSE). Tita prepara alarmas con `crear_alarma` | brief 2026, puntos 12 y 13 |
| Calendario | `GET /calendar?from=YYYY-MM-DD&to=YYYY-MM-DD` (cualquier rol; por defecto el mes en curso; como mucho 62 días, si no 400): `{ from, to, items, summary: { pending, overdue, done } }` con `CalendarItem { id, kind: batch\|receivable\|alarm\|closing, title, detail, date, priority: alta\|media\|baja, area, status: pending\|overdue\|done, href }`. Lotes con existencias que vencen en el rango (ADMIN y WAREHOUSE; alta si vencen en 7 días o ya vencieron → `overdue`; media hasta 30 días), cobros de cartera (ADMIN y SALES; fecha en que la última venta a crédito cumple los 30 días del reporte; vencida → alta y `overdue`, a 5 días → media), alarmas propias (próximos disparos del rango iterando `nextFireAt`; los disparos ocurridos, `done`) cierres de mes (último día de cada mes; `done` si ya pasó), pedidos abiertos (`order`: a proveedor para ADMIN y WAREHOUSE, de cliente para ADMIN y SALES; alta si están atrasados o a 2 días), pagos de nómina sin hacer (`payroll`, solo ADMIN; alta desde 3 días antes) y conteos de inventario pendientes (`count`, ADMIN y WAREHOUSE; alta si son hoy o están atrasados). Lógica pura en `business-logic/calendar/build-calendar.ts` | brief 2.5 (31) |
| Web Push | `GET /push/public-key` (`{ enabled, publicKey }`), `POST /push/subscriptions` (guarda o reemplaza por endpoint), `DELETE /push/subscriptions` `{ endpoint }`. `sendPushTo` da de baja los dispositivos que responden 404/410 | brief 2026, punto 14 |
| Pedidos | `GET /orders?kind=SUPPLIER\|CUSTOMER&status=PENDING,PARTIAL&from=&to=&q=&page&limit` (cualquier rol, pero cada uno solo los tipos que maneja: `SUPPLIER` ADMIN y WAREHOUSE, `CUSTOMER` ADMIN y SALES; pedir un tipo ajeno → 613; `status` acepta varios separados por coma; `from`/`to` sobre la fecha comprometida; `q` busca proveedor, cliente, nota o número; abiertos primero por fecha), `POST /orders` (`kind`, `supplierId` o `customerId` según el tipo, `dueDate`, `note`, `lines[{productId, quantity, unitPrice?}]`: sin precio, el servidor pone el de venta —cliente— o el de compra —proveedor—; `total` lo calcula el servidor), `GET /orders/:id` (con `lines[{…, receivedQuantity, pendingQuantity, lineTotal}]`), `PUT /orders/:id` (solo pendientes, 701; `lines` reemplaza todas), `POST /orders/:id/receive` (ADMIN, WAREHOUSE; `lines[{lineId, quantity, unitCost?, expiresAt}]`: cada línea se registra con `registerPurchase` —lote y stock— en una sola transacción con el pedido bloqueado; parcial → `PARTIAL`, completo → `RECEIVED`; 702 si supera lo que falta; responde `{ order, batches }`), `POST /orders/:id/deliver` (ADMIN, SALES; `saleId` opcional: debe existir —606—, ser del mismo cliente y no estar anulada —704— y no cobrar otro encargo —630—), `POST /orders/:id/cancel` (abiertos; 703 si ya se cerró). Cada pedido trae `counterpartName`, `open`, `overdue` y `daysToDue` (hora del negocio). Para el calendario y los avisos: `listDueOrders(role, untilDate, fromDate?)` en `business-logic/orders/list-due-orders.ts`. **No estaba en el documento 06**: migración `0014_pedidos` (tablas `orders` y `order_lines`) | brief de octubre de 2026 |
| Nómina | `GET/POST /payroll/employees` (`?active=&frequency=MONTHLY\|BIWEEKLY`; nombre, apellido, `documentId` único —630 si se repite—, cargo, `baseSalary` mensual, `payFrequency`, `userId` opcional), `PUT /payroll/employees/:id` (incluye `active` para activar o desactivar), `GET /payroll/periods?status=DRAFT\|APPROVED\|PAID&year=`, `POST /payroll/periods` (`{ frequency, periodStart, periodEnd, payDate }`; crea el borrador con una línea por empleado activo de esa frecuencia y el salario prorrateado: quincenal = mitad del mensual; 708 duplicado, 709 sin empleados), `GET /payroll/periods/:id` (líneas y totales; `editable` solo en borrador), `PUT /payroll/periods/:id/lines/:lineId` (`overtime`, `bonuses`, `transport`, `otherDeductions`; recalcula en el servidor; solo borrador), `POST /payroll/periods/:id/approve`, `POST /payroll/periods/:id/pay` (quién y cuándo), `DELETE /payroll/periods/:id` (solo borrador). Todo solo ADMIN (Secretaria y Bodega: 613). `listUpcomingPayroll(untilDate)` (`business-logic/payroll/list-upcoming-payroll.ts`) da los periodos sin pagar con fecha de pago hasta esa fecha para el calendario y los avisos. **Liquidación simplificada** (`business-logic/payroll/liquidate.ts`): devengado = salario base del periodo + horas extra/recargos + bonificaciones + auxilio de transporte (valores que escribe la persona; el auxilio, del decreto vigente, por defecto 0); deducciones = salud 4 % + pensión 4 % sobre salario base + horas extra, + otros descuentos; neto = devengado − deducciones; pesos enteros. **No es la nómina electrónica de la DIAN** ni calcula prestaciones sociales, aportes del empleador, Fondo de Solidaridad Pensional ni retención en la fuente (pendiente). No estaba en el documento 06: lo pidió el negocio en la Fase A (migración `0015_nomina`) | Fase A, octubre de 2026 |
| Conteos de inventario | `GET /stock-counts?status=&from=&to=&page&limit` (fecha programada inclusive; cada fila trae `totalLines`, `countedLines` y `due`: `OVERDUE`/`TODAY`/`UPCOMING` mientras esté PLANNED o IN_PROGRESS, si no `null`), `POST /stock-counts` (`title`, `scheduledDate` de hoy en adelante, `scope` ALL\|CATEGORY, `categoryId` si es CATEGORY, `note`), `GET /stock-counts/:id` (líneas con producto, SKU, `expectedQuantity`, `countedQuantity`, `difference`, `appliedDifference`, `note` y `summary`), `PUT /stock-counts/:id` (título, fecha y nota; solo PLANNED), `POST /stock-counts/:id/start` (PLANNED → IN_PROGRESS: una línea por producto activo del alcance con la foto de `products.stock`), `PUT /stock-counts/:id/lines` (`[{ productId, countedQuantity \| null, note? }]`; se guarda a medias; solo IN_PROGRESS), `POST /stock-counts/:id/submit` (→ SUBMITTED; 712 si queda alguna sin contar), `GET /stock-counts/:id/preview-adjustment` (solo SUBMITTED: diferencia = contado − stock físico **actual**, con los lotes que bajaría cada faltante —vencidos primero, luego el que vence antes— y el costo del lote de cada sobrante), `POST /stock-counts/:id/apply` (**solo ADMIN**; `{ surplusLots: [{ productId, expiresAt }] }`; en una transacción con conteo, productos y lotes bloqueados: los faltantes bajan `quantity_remaining` por FEFO y `products.stock`; los sobrantes crean un lote con `registerBatch` al último costo conocido —o el precio de compra vigente—; cada movimiento queda en `stock_count_adjustments`; responde el conteo con `adjustments`), `POST /stock-counts/:id/cancel` (PLANNED o IN_PROGRESS). Todo lo demás ADMIN y WAREHOUSE; SALES recibe 613. `listScheduledCounts(untilDate, { fromDate? })` en `business-logic/stock-counts/list-scheduled-counts.ts` da los pendientes para el calendario y los avisos. Migración `0016_conteos_inventario`. No estaba en el documento 06 | extensión |

### Ejemplo con curl

```bash
# 1. Iniciar sesión y guardar el token
TOKEN=$(curl -s -X POST http://localhost:4300/api/v1/auth/signin \
  -H "Content-Type: application/json" \
  -d '{"username":"demo.admin","password":"<clave>"}' | jq -r .token)

# 2. Productos con stock vendible
curl -s http://localhost:4300/api/v1/products?limit=5 -H "Authorization: Bearer $TOKEN"

# 3. Cálculo del simulador con el ejemplo de la ampliación
curl -s http://localhost:4300/api/v1/financial/simulator/defaults -H "Authorization: Bearer $TOKEN"
```

---

## Reglas de Negocio

- **Hora del negocio.** "Hoy", los cortes de reportes y los vencimientos se cuentan en `BUSINESS_TZ`
  (America/Bogota); cada sesión de PostgreSQL abre en esa zona, así una venta de las 8 p. m. es del mismo día.
- **Stock vendible.** Cada producto trae `stock` (físico, incluye lotes vencidos aún en bodega) y `availableStock`
  (lotes no vencidos): lo que FEFO puede vender hoy. Un lote que ya llega vencido se rechaza con 400.
- **Búsqueda.** Clientes y productos se buscan sin importar tildes ni mayúsculas ("maria perez" encuentra a "María Pérez").
- **Tita.** Las herramientas de consulta usan la misma lógica y los mismos roles que sus endpoints. Las de acción no
  escriben: validan con el `parseX` del endpoint y devuelven la petición exacta; la app la ejecuta contra la API real
  solo si la persona confirma. Las recomendaciones del día (reponer, rotar, cobrar, sin rotación) se calculan en SQL sin
  IA; la IA solo las prioriza y redacta. El contenido de imágenes y documentos se trata como datos, nunca como
  instrucciones. Las rutas `/ai` tienen un tope de 40 consultas cada 5 minutos por persona.

- **Chat y presencia.** El canal general tiene `recipient_id` nulo; un mensaje privado lo lleva y solo lo ven sus
  dos participantes. Cada petición autenticada actualiza `users.last_seen_at` (como mucho cada 20 s, fuera de la
  auditoría); en línea = actividad en los últimos 90 s sin un cierre de sesión posterior.
  - **Acuses (`chat_receipts`).** Al enviar, cada destinatario (el equipo activo en #general; la otra persona en un
    privado) recibe un acuse. *Entregado* cuando su app recibe el mensaje (aviso en vivo, consulta del equipo o de la
    conversación); *visto* cuando tiene la conversación a la vista (`POST /chat/read`, que no se audita). Los chulitos
    del autor: enviado / entregado a todos / visto por todos (las cuentas desactivadas no cuentan). El detalle por
    persona (`/receipts`) solo lo consulta el autor.
  - **Citas, hilos y respuesta privada.** Se cita un mensaje de la misma conversación; la única excepción es responder
    por privado al autor de un mensaje de #general (la respuesta no aparece en el canal). Un hilo se abre sobre un
    mensaje de la conversación principal (sin hilos anidados) y sus respuestas no salen en ella; la raíz trae el resumen
    (respuestas, sin leer, participantes).
  - **Fijados.** En #general fija y desfija solo ADMIN; en un privado, cualquiera de los dos. Máximo 10 por
    conversación; las respuestas de hilos no se fijan.
  - **Menciones.** `@usuario` (y `@todos` / `@equipo` en #general) solo cuentan para quien puede ver el mensaje.
  - **Adjuntos.** Fotos, PDF, Excel, Word, CSV y texto, hasta 10 MB y 5 por mensaje; se guardan en la base
    (`chat_attachments`). Solo los descarga quien puede ver el mensaje; los subidos y no enviados se borran a las 24 h.
  - **Editar y eliminar.** Solo el autor edita (queda `editedAt`; las menciones se recalculan). Elimina el autor y,
    en #general, también ADMIN; el mensaje conserva su lugar, sus acuses y su hilo, pero pierde texto, menciones,
    adjuntos (también el archivo) y fijado, y deja de contar como no leído. No se cita ni se busca un eliminado.
  - **Sin duplicados.** La app manda un `clientId` (UUID) por envío; un reintento devuelve el mismo mensaje.
  - **Tiempo real.** `GET /chat/stream` (Server-Sent Events, token en la cabecera) avisa de mensajes nuevos, cambios
    de acuses, fijados y lecturas solo a quien puede ver la conversación; el aviso no trae la conversación, la app la
    pide por REST. Entre instancias viaja por `LISTEN/NOTIFY` de PostgreSQL (`chat_events`); si esa conexión se cae, se
    entrega en la instancia local. La conexión se corta si la sesión vence o se cierra.

- **FEFO (RF-02.6).** Una venta descuenta del lote con vencimiento más próximo, saltando los lotes ya
  vencidos; puede consumir varios lotes y deja la asignación en `sale_line_batch_allocations`. Si no
  alcanza responde 620 con `available` (unidades no vencidas).
- **Precio congelado y total en el servidor (RF-03.1, RF-03.2).** El cliente solo envía producto y cantidad.
- **Crédito (RF-04.2).** Con `paymentType: CREDIT` el cliente es obligatorio; se rechaza con 621 si
  `saldo + total > cupo`. El saldo sube con la venta y baja con cada abono; un abono mayor al saldo
  responde 623.
- **Anulación (RF-03.4).** Solo ADMIN. Devuelve cada cantidad al lote de origen, repone el stock y, si fue a
  crédito, baja la cartera (sin dejarla negativa). La venta queda `VOIDED` con fecha y usuario; no se borra.
- **Correlativo de factura.** `FV-AAAA-NNNNNN` con contador propio por año y bloqueo de fila.
- **Cartera vencida (supuesto).** El modelo no tiene fechas de vencimiento por venta, así que se considera
  vencida la cartera de un cliente con saldo mayor que cero cuya última venta a crédito tiene más de
  `overdueDays` días (30 por defecto, configurable en la consulta).
- **Finanzas (RF-06, RNF-10).** El motor de `business-logic/financial/engine.ts` es un porte 1:1 de
  `1 Motor de calculo.py`; las pruebas reproducen los escenarios A, B, C y D de `2 Resultados del modelo.json`
  y las tablas 8 a 12 del capítulo 5. Los resultados se guardan al crear el escenario (RF-06.8) y la
  sensibilidad, la grilla bivariante y el tornado se calculan sobre los supuestos guardados.
- **Simulador financiero (Fase B).** `business-logic/financial/simulator.ts` (función pura `simulate`) es la única
  fuente de las cifras de la pantalla de Finanzas, del informe PDF/Excel, de «Exportar escenario» y de Tita
  (`escenarios_financieros`, `crear_escenario`, borrador `scenario_explain` con `projectId`). Secciones en cadena:
  demanda = población × disposición × consumo; crecimiento = PIB × sensibilidad + desempleo × sensibilidad; cuota de
  mercado = Σ cuota × (1 − satisfacción ÷ 5) × factor de conversión; costos por unidades vendidas con IPC desde el año 2;
  precio = costo unitario del año 1 × (1 + margen sobre el costo), que desde el año 2 sube con el IPC; impuesto sobre
  EBITDA − depreciación y amortización; flujo libre sin deuda descontado a la tasa mínima exigida; año final con
  capital de trabajo y salvamento al valor neto en libros; crédito en sistema francés solo para Financiación y
  cobertura (flujo libre del año ÷ cuotas del año). Tornado: precio, costo variable y demanda ±10 %, tasa ±3 puntos,
  IPC ±2 puntos; escenarios pesimista (demanda −10 %, precio −5 %) y optimista (+10 %, +5 %). Decisiones en
  `DECISIONES-FASE-B.md`; pruebas en `tests/financial-simulator.test.ts`.
- **Reportes (RF-08.4).** Todos se agregan en SQL; nunca se traen listas completas a memoria.

---

## Códigos de error

| Código | Significado | HTTP |
|---|---|---|
| 400 | Datos de entrada mal formados (trae `details`) | 400 |
| 404 | Ruta inexistente | 404 |
| 500 | Error interno | 500 |
| 601 | Producto no encontrado | 404 |
| 602 | Categoría no encontrada | 404 |
| 603 | Usuario no encontrado | 404 |
| 604 | Cliente no encontrado | 404 |
| 605 | Proveedor no encontrado | 404 |
| 606 | Venta no encontrada | 404 |
| 607 | Escenario financiero no encontrado | 404 |
| 608 | Contacto del sitio no encontrado | 404 |
| 609 | Mensaje o adjunto del chat no encontrado (o de un privado ajeno: no se revela que exista) | 404 |
| 610 | Credenciales inválidas | 401 |
| 611 | Token ausente o inválido | 401 |
| 612 | Usuario inactivo | 401 |
| 613 | Rol insuficiente (trae `requiredRoles`) | 403 |
| 620 | Stock insuficiente | 409 |
| 621 | Cupo de crédito excedido | 409 |
| 622 | La venta ya estaba anulada | 409 |
| 623 | Abono mayor al saldo de cartera | 409 |
| 625 | Producto inactivo | 409 |
| 626 | Cliente inactivo | 409 |
| 630 | Recurso duplicado (unique) | 409 |
| 631 | Categoría con productos asociados | 409 |
| 640 | Demasiados intentos de acceso | 429 |
| 650 | Escenario financiero inválido | 422 |
| 660 | IA no configurada (falta `ANTHROPIC_API_KEY`) | 503 |
| 661 | El proveedor de IA falló o no respondió | 502 |
| 662 | La tarea de Tita no existe, venció (10 min) o es de otra persona | 404 |
| 663 | La conversación de Tita no existe o es de otra persona | 404 |
| 670 | La alarma no existe o es de otra persona | 404 |
| 671 | Programación de alarma sin disparo futuro (una sola vez con fecha y hora ya pasadas) | 422 |
| 672 | Tope de 50 alarmas por persona alcanzado | 409 |
| 673 | Web Push no configurado (falta el par VAPID) | 503 |
| 674 | La suscripción push no existe o es de otra persona | 404 |
| 680 | El documento (folio del QR) no existe | 404 |
| 685 | El comentario no existe (o ya se eliminó) | 404 |
| 686 | El comentario al que se responde es de otro registro o se eliminó | 409 |
| 687 | Solo el autor o la administración puede eliminar el comentario | 403 |
| 688 | El registro que se quiere comentar no existe | 404 |
| 690 | El ítem de la biblioteca no existe o el rol no puede verlo | 404 |
| 691 | La persona no tiene foto de perfil | 404 |
| 700 | El pedido no existe | 404 |
| 701 | El pedido no está pendiente (se recibió en parte, se cerró o se canceló): no se edita | 409 |
| 702 | La recepción supera lo que falta por recibir en una línea (trae `lineId`, `pending`, `requested`) | 409 |
| 703 | El pedido ya está cerrado (recibido, entregado o cancelado): no se recibe, entrega ni cancela | 409 |
| 704 | La venta indicada al entregar no es del cliente del encargo o está anulada | 409 |
| 705 | El empleado de nómina no existe | 404 |
| 706 | El periodo de nómina (o la línea dentro de él) no existe | 404 |
| 707 | El periodo de nómina no admite ese cambio: solo un borrador se edita, aprueba o elimina, y solo uno aprobado se marca pagado | 409 |
| 708 | Ya existe un periodo de nómina de esa frecuencia con la misma fecha de inicio | 409 |
| 709 | No hay empleados activos con esa frecuencia de pago para crear el periodo | 422 |
| 710 | El conteo de inventario no existe | 404 |
| 711 | El conteo no está en un estado que permita esa acción (trae `status`, `action`, `allowedFrom`) | 409 |
| 712 | Faltan líneas por contar para enviar el conteo (trae `pending` y `productIds`) | 422 |
| 713 | Falta (o es anterior a hoy) la fecha de vencimiento del lote de ajuste de un sobrante (trae `[{ path: "expiresAt.<productId>", productId, message }]`) | 400 |
| 714 | Un faltante del conteo es mayor que las unidades en lotes del producto (trae `requested`, `available`) | 409 |
| 715 | Proyecto del simulador no encontrado (trae `missing` en la comparación) | 404 |
| 716 | Solo el dueño del proyecto del simulador puede guardarlo encima o eliminarlo | 403 |

---

## Seguridad

| Medida | Cómo se aplica |
|---|---|
| Contraseñas | bcrypt; nunca salen en una respuesta ni en la auditoría |
| Tokens | JWT HS256 con `JWT_SECRET` de al menos 32 caracteres y versión de token para invalidar sesiones |
| Autorización | Toda ruta nace protegida y declara sus roles; la identidad sale del token, nunca del cuerpo |
| Cabeceras | `helmet` y CORS limitado a `CORS_ORIGINS` |
| Límites de uso | Inicio de sesión (`640`), formulario de contacto (5 por hora), verificación de folios (30 por minuto) y Tita (40 consultas cada 5 minutos) |
| Errores | Un solo manejador responde `{ message: "<código>" }`; nunca un stack trace |
| Auditoría | Cada escritura exitosa queda registrada con usuario, método, recurso, cambios y la marca `ai_suggested` |
| IA | Tita no escribe: devuelve la petición exacta y la persona confirma; imágenes y documentos se tratan como datos |

---

## Pruebas

```bash
pnpm test        # node:test; no necesita base de datos ni clave de IA
pnpm typecheck   # tsc --noEmit
```

Las pruebas viven en [tests/](tests) (un archivo por módulo: validación, errores, paginación, token, motor y simulador
financiero, chat, alarmas, pedidos, nómina, conteos, reportes, búsqueda, comentarios, biblioteca, datos de ejemplo,
entre otros). El simulador se prueba contra el ejemplo de la ampliación del local (VPN de unos $19,8 M al 18 %) y su tornado.

---

## Despliegue

El backend se empaqueta como imagen de contenedor ([Dockerfile](Dockerfile)); CI
([.github/workflows/ci.yml](.github/workflows/ci.yml)) hace typecheck, pruebas, migraciones contra un
PostgreSQL efímero, build y construye la imagen. En producción la API corre detrás de un proxy HTTPS
y la base es un servicio gestionado aparte con respaldos automáticos; la API no guarda estado entre
peticiones, así que puede reiniciarse sin pérdida.

---

## Solución de Problemas

| Síntoma | Causa probable | Solución |
|---|---|---|
| `ECONNREFUSED 127.0.0.1:5433` al arrancar | La base no está corriendo | `docker compose up -d db` o revisa `DB_HOST`/`DB_PORT` |
| La API no arranca y pide `JWT_SECRET` | Falta la variable o es corta | Define un `JWT_SECRET` de 32 caracteres o más en `.env` |
| `relation … does not exist` | Base sin migrar | `pnpm db:migrate` |
| La app responde `611` en todo | Token vencido o de otra instancia | Vuelve a iniciar sesión |
| Las rutas `/ai` responden `660` | Falta `ANTHROPIC_API_KEY` | Configúrala; sin ella la app oculta a Tita |
| `/push/subscriptions` responde `673` | Falta el par VAPID | `pnpm vapid` y define `VAPID_*` |
| CORS bloquea la app | El dominio no está en `CORS_ORIGINS` | Agrega el dominio del frontend separado por comas |

---

## Decisiones pendientes con el negocio

- Política exacta de anulación de una venta (RF-03.4): plazo y si queda registro o se borra.
- Si la Secretaria ve el reporte de ventas completo o solo el de su turno (CU-10, CU-19). Hoy ve todo;
  el filtro `?userId=` de `GET /sales` permite restringirlo desde el frontend mientras se decide.
- Si una venta puede consumir lotes ya vencidos. Hoy el FEFO los salta y quedan visibles en
  `GET /batches/expiring` y en el reporte de inventario para darles de baja.
- Desactivar cuentas y cambiar roles: no hay endpoint todavía (pendiente P-01 de la auditoría).
- Si Bodega puede crear y editar proveedores: la API lo permite y la interfaz no lo ofrece (pendiente P-02).
- Nómina: es una liquidación simplificada. Quedan pendientes la nómina electrónica de la DIAN, las prestaciones
  sociales (prima, cesantías e intereses, vacaciones), los aportes del empleador (salud, pensión, ARL, parafiscales),
  el Fondo de Solidaridad Pensional y la retención en la fuente; y decidir si alguna bonificación es salarial (hoy no cotiza).
  Ningún valor legal anual (salario mínimo, auxilio de transporte) está en el código: el auxilio se escribe por línea.

---

## Fases del Desarrollo

| Fase | Alcance | Estado |
|---|---|---|
| Documentación técnica | Arquitectura, requisitos, casos de uso, modelo de datos, diseño de la API e infraestructura | Completado |
| Núcleo ERP | Usuarios y roles, inventario con lotes y FEFO, ventas, clientes y cartera, proveedores, auditoría y reportes | Completado |
| Comunicación y Tita | Chat con acuses, hilos y adjuntos; contactos; Tita con acciones confirmadas; alarmas y Web Push | Completado |
| Fase A | Pedidos, conteos de inventario, nómina simplificada, biblioteca, calendario, comentarios e historial | Completado |
| Fase B | Simulador financiero por unidades, proyectos guardados e informe del proyecto | Completado |
| Cierre | Líneas públicas de categorías, reinicio de datos para producción y documentación | Completado |

El detalle de cada cambio está en [CHANGELOG.md](CHANGELOG.md).

---

## Autores

| Nombre | Programa | Trabajo |
|---|---|---|
| Karina Redondo Sáez | Ingeniería de Software | Sistemas de Información Gerencial · Ingeniería Económica |
| Alexa Patricia Ricardo Lozano | Ingeniería de Software | Sistemas de Información Gerencial · Ingeniería Económica |
| Edgar Alexander Matos Rivera | Ingeniería de Software | Ingeniería Económica |

Universidad de Cartagena · Facultad de Ingeniería · CT Cereté
Sistemas de Información Gerencial (AL17705) · Docente: Esp. Luis Antonio Sarruf Durango
Ingeniería Económica (FC17701) · Docente: Esp. Estrella del Carmen Camacho Alvis

---

## Notas Académicas

- Proyecto desarrollado con fines académicos como Trabajo Colaborativo Contextualizado del semestre 2026-2.
- Los usuarios, clientes, ventas y cifras de demostración son ficticios; las cifras financieras son de ejemplo con
  supuestos académicos que la gerencia debe confirmar.
- La facturación electrónica de la DIAN y la nómina electrónica quedan fuera del alcance.

---

## Licencias

### Código del proyecto

© 2026 Karina Redondo Sáez, Alexa Patricia Ricardo Lozano y Edgar Alexander Matos Rivera. **Todos los derechos
reservados.** Mi Tierrita SIG es un Trabajo Colaborativo Contextualizado del programa de Ingeniería de Software de la
Universidad de Cartagena. El código se puede consultar en este repositorio, pero no se concede permiso para usarlo,
copiarlo, modificarlo ni distribuirlo sin autorización escrita de los autores (por eso `package.json` declara
`"license": "UNLICENSED"`). El texto completo está en [LICENSE](LICENSE). El motor financiero es un porte del modelo de cálculo del mismo trabajo y tiene la misma reserva.

### Dependencias

Las dependencias directas de producción y sus licencias:

| Paquete | Licencia |
|---|---|
| express, cors, helmet, express-rate-limit | MIT |
| pg | MIT |
| jsonwebtoken | MIT |
| swagger-ui-express | MIT (incluye swagger-ui-dist, Apache-2.0) |
| @anthropic-ai/sdk | MIT |
| bcryptjs | BSD-3-Clause |
| dotenv | BSD-2-Clause |
| yaml | ISC |

Entre las 111 dependencias de producción (incluidas las transitivas) hay licencias MIT, ISC, BSD-2-Clause, BSD-3-Clause,
Apache-2.0 y Unlicense; todas permiten este uso. El detalle actualizado se obtiene con `pnpm licenses list --prod`.

### Servicios externos

Tita usa la API de Claude de Anthropic cuando hay `ANTHROPIC_API_KEY`. El SDK es MIT; el uso del servicio se rige por
los términos comerciales de Anthropic de la cuenta que aporta la clave, no por la licencia de este repositorio.
