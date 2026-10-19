# Mi Tierrita API — guía para sesiones de trabajo

Backend REST de Mi Tierrita SIG (Express 5 + PostgreSQL 16 + TypeScript, CommonJS, imports sin extensión). El diseño canónico
vive en la documentación técnica del TCC (`~/Desktop/TCC Ingenieria Economica/6 Documentacion tecnica`):
01 arquitectura, 03 requisitos, 04 casos de uso, 05 modelo de datos, 06 diseño de la API, 08 infraestructura.
No inventar endpoints ni tablas que no estén ahí sin dejarlo escrito en el README.

## Comandos

`pnpm dev` (puerto 4300, prefijo `/api/v1`) · `pnpm typecheck` · `pnpm test` · `pnpm db:migrate` ·
`pnpm db:status` · `pnpm create-admin <usuario> <clave>` · `docker compose up -d db`.

## Reglas de oro

1. **Capas con un solo motivo de cambio**: `routes/` solo cablea ruta + `authorize` + controlador (un
   archivo por entidad); `controllers/` solo HTTP (parsear entrada con `parseX`, llamar a la lógica,
   responder); `business-logic/` dominio + SQL (jamás importa Express); `data-sources/` solo el pool,
   transacciones y helpers de errores de PostgreSQL; `models/` solo tipos, `toXResponse` y `parseX`.
   Un archivo por operación + barrels. Sin zod ni ORM: la validación usa `common/validate.ts`.
2. **Toda ruta nueva nace protegida**: se monta en `routes/index.ts` después de `authenticate` y
   restringe con `authorize(...)` según la tabla de roles del documento 06. Identidad desde
   `requireAuth(req)`, nunca desde el body.
3. **Errores solo por código**: `throw domainError(ErrorCodes.X)`; nuevos códigos se agregan a
   `common/errors.ts` y a la tabla del README. Nunca `res.status(...).json({ message: "texto libre" })`.
4. **Auditoría intocable**: la registra el middleware; nunca duplicarla en rutas ni loguear contraseñas.
   Únicas excepciones (v4.2), porque son lecturas: la descarga de un reporte (`AuditMethods.EXPORT`, en
   `controllers/exports`) y el inicio de sesión (`AuditMethods.SIGNIN`), ambos con `detail` legible.
5. **Esquema solo por migraciones** numeradas en `migrations/` con encabezado "qué cambia / por qué".
   Una migración aplicada no se edita.
6. **Dinero de negocio en `DECIMAL(12,2)`**; el módulo financiero usa `DOUBLE PRECISION`. Los totales
   e indicadores se calculan en el servidor; los que envíe el cliente se ignoran.
7. **Contadores denormalizados** (`products.stock`, `customers.balance`) se mueven en la misma
   transacción que la operación que los cambia, con bloqueo de fila (`SELECT ... FOR UPDATE`).
8. Listados `{ count, page, pages, items }` con `parsePageRequest`/`toPageResponse`.
9. Sin clases en dominio: funciones flecha exportadas. Copiar el módulo `categories` antes que inventar.
   Orden de rutas: las fijas (`/me/password`, `/scenarios/compare`) van antes que las de `/:id`.
10. Cada módulo nuevo actualiza `docs/openapi.yaml` y la tabla "Estado de la API" del README.

## Tiempo real (v4)

11. **Socket.io vive en `src/sockets/`**: `index.ts` autentica con el mismo JWT y une a las salas `canal:general`,
    `usuario:<id>` y `rol:<ROL>`; `chat-handler.ts` define los eventos; `presence.ts` lleva quién está en línea.
    La lógica de negocio **nunca importa Socket.io**: emite con `sockets/emitter.ts` (`emitToAll`, `emitToUsers`,
    `emitToRoles`), que no hace nada si no hay servidor (pruebas y scripts).
12. Un evento nuevo de negocio se agrega en `business-logic/notifications/business-events.ts` y se llama desde el
    controlador **después** de que la operación quedó guardada; una falla al notificar se registra y no tumba la respuesta.
13. Toda escritura exitosa de un recurso de `LIVE_RESOURCES` emite `datos:cambio` (middleware `server/live-events.ts`).
14. El contrato de eventos está en el README («Eventos Socket.io»): cambiar un nombre o una carga útil exige
    actualizar la aplicación (`src/realtime/`) y el README en el mismo commit.

## Reportes (v4.2)

15. Los PDF y Excel se arman en `business-logic/exports/` con `pdf-theme.ts` (colores «Campo abierto», encabezado
    con «Generado por», gráficos vectoriales, tabla y pie «Página n de N»). Un reporte nuevo reutiliza esos
    helpers y su controlador pasa por `send()` para quedar auditado; nunca generar el PDF en el navegador.
16. **Chat v4.5**: cada mensaje tiene recibos por persona (`message_receipts`); el autor es el único que ve el detalle
    (`forAudience` anula `receipts` para los demás). Todo envío pasa por `business-logic/chat/deliver.ts#sendMessage`
    (REST y Socket.io comparten la misma ruta), con `clientId` para no duplicar. Los adjuntos y el audio se
    descargan solo si la persona puede ver el mensaje (`readAttachment`). Prueba con base real: `tests/chat-avanzado.test.ts`.
