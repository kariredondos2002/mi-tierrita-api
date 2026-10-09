-- Entrega v4 · Tiempo real (Socket.io) y página pública.
--   messages       chat persistente: canal general (recipient_id NULL) y privados entre usuarios
--   notifications  avisos automáticos de eventos del negocio (venta, abono, compra, escenario, stock bajo)
--   contact_messages  formulario de contacto de la página pública de inicio
--   users.last_seen_at  última conexión (se actualiza al cerrar el último socket del usuario)

ALTER TABLE users ADD COLUMN last_seen_at TIMESTAMPTZ;

CREATE TABLE messages (
  id           BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  sender_id    BIGINT      NOT NULL REFERENCES users (id),
  recipient_id BIGINT      REFERENCES users (id),
  content      TEXT        NOT NULL CHECK (length(content) BETWEEN 1 AND 2000),
  read_at      TIMESTAMPTZ,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (recipient_id IS NULL OR recipient_id <> sender_id)
);
-- Historial del canal general y de cada conversación privada, del más reciente al más antiguo.
CREATE INDEX messages_general_idx ON messages (created_at DESC, id DESC) WHERE recipient_id IS NULL;
CREATE INDEX messages_private_idx ON messages (sender_id, recipient_id, created_at DESC);
CREATE INDEX messages_unread_idx ON messages (recipient_id) WHERE read_at IS NULL;

CREATE TABLE notifications (
  id         BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id    BIGINT       NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  kind       VARCHAR(40)  NOT NULL,
  message    VARCHAR(300) NOT NULL,
  link       VARCHAR(200),
  read       BOOLEAN      NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ  NOT NULL DEFAULT now()
);
CREATE INDEX notifications_user_idx ON notifications (user_id, read, created_at DESC);

CREATE TABLE contact_messages (
  id         BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name       VARCHAR(120) NOT NULL,
  email      VARCHAR(160) NOT NULL,
  phone      VARCHAR(40),
  message    VARCHAR(2000) NOT NULL,
  handled    BOOLEAN      NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ  NOT NULL DEFAULT now()
);
CREATE INDEX contact_messages_created_idx ON contact_messages (created_at DESC);
