-- Contacto público ampliado (paridad con el repositorio de Matos).
--   contact_messages.email  pasa a ser opcional: basta un teléfono o un correo para poder responder
--   contact_messages.topic  asunto elegido en el formulario (opcional)
-- Por qué: en una tienda de pueblo muchas personas solo dejan el WhatsApp; exigir correo hacía perder consultas.

ALTER TABLE contact_messages ALTER COLUMN email DROP NOT NULL;
ALTER TABLE contact_messages ADD COLUMN topic VARCHAR(80);
ALTER TABLE contact_messages ADD CONSTRAINT contact_messages_reply_check CHECK (email IS NOT NULL OR phone IS NOT NULL);
