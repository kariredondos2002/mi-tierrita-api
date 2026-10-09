-- Versión 4.2 · Perfil completo y auditoría de reportes.
--   users: correo, teléfono y fecha de actualización para la pantalla «Mi perfil» (como en SoftUnity).
--   audits.detail: descripción legible de la acción (p. ej. «Reporte de ventas · PDF · 2026-09-01 a 2026-09-30»).
--   El método EXPORT registra quién generó cada reporte y cuándo; SIGNIN y SIGNOUT, los accesos.

ALTER TABLE users ADD COLUMN email VARCHAR(160);
ALTER TABLE users ADD COLUMN phone VARCHAR(40);
ALTER TABLE users ADD COLUMN updated_at TIMESTAMPTZ;
CREATE UNIQUE INDEX users_email_unique ON users (lower(email)) WHERE email IS NOT NULL;

ALTER TABLE audits ADD COLUMN detail VARCHAR(300);
CREATE INDEX audits_method_idx ON audits (method, created_at DESC);
