# Datos de prueba · API

`pnpm db:seed` llena la base con una agropecuaria de ejemplo de Sahagún (Córdoba) usando la lógica de negocio real.
Es idempotente: correrlo dos veces no duplica nada. El detalle de lo que crea está en la sección
[Datos de ejemplo](../README.md#datos-de-ejemplo) del README, junto con la clave de las cuentas demo.

## Cuentas por rol

| Usuario | Rol | Nombre en la demo | Qué probar |
|---|---|---|---|
| `demo.admin` | Administrador (`ADMIN`) | Karina Demo | Inicio con indicadores, lotes, anular una venta, aprobar un ajuste de conteo, nómina, Finanzas (proyectos de 70 % y 100 % con crédito), reportes con folio, usuarios y auditoría |
| `demo.caja` | Secretaria (`SALES`) | Luisa Demo | «Caja y cartera», venta de contado y a crédito (el cupo se valida), abono a un cliente, pedido de cliente, reporte de ventas |
| `demo.bodega` | Bodega (`WAREHOUSE`) | Jairo Demo | Lotes por vencer y vencidos, compra con lote, recibir un pedido a proveedor, hacer un conteo de inventario |

Para ver el tiempo real, abre dos navegadores con cuentas distintas y escribe en el chat: los acuses pasan de enviado a
entregado y visto.

## Reiniciar los datos

```bash
RESET_DATA_CONFIRM=<marca> pnpm db:reset   # vacía las tablas de negocio y conserva las cuentas
pnpm db:seed                               # vuelve a sembrar
```

Cada marca sirve una sola vez (queda anotada en `data_resets`). Todos los datos de ejemplo son ficticios.
