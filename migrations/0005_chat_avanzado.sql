-- 0005 · Chat avanzado del equipo
--
-- Qué cambia: los mensajes ganan tipo (texto, audio, archivo), cita (reply_to_id), hilo (thread_root_id), identificador del
-- cliente contra duplicados (client_id), fijado (pinned_at / pinned_by). Nuevas tablas: recibos por destinatario
-- (enviado / entregado / visto), menciones y adjuntos (el archivo vive en la base, hasta 6 MB).
-- Por qué: el administrador, la secretaría y el mostrador de bodega necesitan saber quién recibió y leyó cada mensaje,
-- responder citando o en hilo, fijar lo importante, mencionar, adjuntar y enviar audios, sin duplicar mensajes al reconectar.

-- Un audio o un archivo puede ir sin texto: el contenido pasa a admitir vacío (la API exige texto o adjunto).
ALTER TABLE messages DROP CONSTRAINT IF EXISTS messages_content_check;
ALTER TABLE messages ADD CONSTRAINT messages_content_len CHECK (length(content) <= 2000);

ALTER TABLE messages
  ADD COLUMN kind           VARCHAR(8) NOT NULL DEFAULT 'TEXT' CHECK (kind IN ('TEXT', 'AUDIO', 'FILE')),
  ADD COLUMN reply_to_id    BIGINT REFERENCES messages (id) ON DELETE SET NULL,
  ADD COLUMN thread_root_id BIGINT REFERENCES messages (id) ON DELETE CASCADE,
  ADD COLUMN client_id      UUID,
  ADD COLUMN pinned_at      TIMESTAMPTZ,
  ADD COLUMN pinned_by      BIGINT REFERENCES users (id);

-- Reintentar el mismo envío (reconexión, doble clic) devuelve el mensaje ya guardado en vez de crear otro.
CREATE UNIQUE INDEX messages_client_uidx ON messages (sender_id, client_id) WHERE client_id IS NOT NULL;
CREATE INDEX messages_thread_idx ON messages (thread_root_id, created_at) WHERE thread_root_id IS NOT NULL;
CREATE INDEX messages_pinned_idx ON messages (pinned_at DESC) WHERE pinned_at IS NOT NULL;

CREATE TABLE message_receipts (
  message_id   BIGINT      NOT NULL REFERENCES messages (id) ON DELETE CASCADE,
  user_id      BIGINT      NOT NULL REFERENCES users (id),
  delivered_at TIMESTAMPTZ,
  read_at      TIMESTAMPTZ,
  PRIMARY KEY (message_id, user_id)
);
CREATE INDEX message_receipts_unread_idx ON message_receipts (user_id) WHERE read_at IS NULL;
CREATE INDEX message_receipts_undelivered_idx ON message_receipts (user_id) WHERE delivered_at IS NULL;

CREATE TABLE message_mentions (
  message_id BIGINT NOT NULL REFERENCES messages (id) ON DELETE CASCADE,
  user_id    BIGINT NOT NULL REFERENCES users (id),
  PRIMARY KEY (message_id, user_id)
);

CREATE TABLE message_attachments (
  id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  uploader_id BIGINT       NOT NULL REFERENCES users (id),
  message_id  BIGINT       REFERENCES messages (id) ON DELETE CASCADE,
  file_name   VARCHAR(160) NOT NULL,
  mime_type   VARCHAR(100) NOT NULL,
  size_bytes  INTEGER      NOT NULL CHECK (size_bytes BETWEEN 1 AND 6291456),
  duration_ms INTEGER,
  data        BYTEA        NOT NULL,
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT now()
);
CREATE INDEX message_attachments_message_idx ON message_attachments (message_id);
CREATE INDEX message_attachments_orphan_idx ON message_attachments (created_at) WHERE message_id IS NULL;

-- Recibos de los mensajes que ya existían: se dan por entregados; los privados conservan su lectura y el canal general
-- se da por leído para no llenar de «sin leer» a todo el equipo el día de la migración.
INSERT INTO message_receipts (message_id, user_id, delivered_at, read_at)
SELECT m.id, m.recipient_id, m.created_at, m.read_at FROM messages m WHERE m.recipient_id IS NOT NULL;

INSERT INTO message_receipts (message_id, user_id, delivered_at, read_at)
SELECT m.id, u.id, m.created_at, m.created_at FROM messages m JOIN users u ON u.active AND u.id <> m.sender_id WHERE m.recipient_id IS NULL;
