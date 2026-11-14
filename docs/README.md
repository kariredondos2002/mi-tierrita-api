# Documentación de Mi Tierrita SIG · API

| Documento | Contenido |
|---|---|
| [../README.md](../README.md) | Visión general, marco teórico, arquitectura, base de datos, API REST, reglas de negocio, seguridad y pruebas |
| [desarrollo.md](desarrollo.md) | Entorno local, scripts, reglas del código, ramas y definición de «terminado» |
| [datos-de-prueba.md](datos-de-prueba.md) | Cuentas demo por rol, qué probar con cada una y cómo reiniciar los datos |
| [DESPLIEGUE.md](DESPLIEGUE.md) | Contenedor, base gestionada, variables y verificación en producción |
| [openapi.yaml](openapi.yaml) | Contrato OpenAPI 3.1 de todos los endpoints (también en `/docs` de la API) |
| [ENLACES.md](ENLACES.md) | Repositorios, demostración, presentación, diseño, manuales y diagramas |

El historial de cambios está en [CHANGELOG.md](../CHANGELOG.md) y el esquema de la base en [migrations/](../migrations).

## Orden de lectura sugerido

- **Desarrollo:** README (arquitectura y API), desarrollo y datos de prueba.
- **Despliegue:** DESPLIEGUE y la sección de variables de entorno del README.
- **Informe del TCC:** README (descripción, marco teórico, base de datos y reglas de negocio) y ENLACES.

## Mantener la documentación al día

Un cambio que modifique un endpoint, una tabla, un código de error o una variable de entorno actualiza en el mismo
commit `openapi.yaml`, la tabla correspondiente del README y el CHANGELOG.
