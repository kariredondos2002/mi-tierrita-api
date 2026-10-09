import { config } from "./config";
import { createApp } from "./app";
import { createServer } from "node:http";
import { db } from "../data-sources/index";
import { attachSockets } from "../sockets/index";

const main = async () => {
  await db.ping();
  const app = createApp();
  const server = createServer(app);
  const io = attachSockets(server);
  server.listen(config.port, () => {
    console.log(`Mi Tierrita API escuchando en http://localhost:${config.port}${config.apiPrefix}`);
    console.log(`Documentación OpenAPI en http://localhost:${config.port}/docs`);
    console.log(`Socket.io (chat y tiempo real) en ws://localhost:${config.port}/socket.io`);
  });

  const shutdown = (signal: string) => {
    console.log(`Recibida señal ${signal}, cerrando...`);
    void io.close();
    server.close(() => {
      void db.close().finally(() => process.exit(0));
    });
  };
  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("SIGTERM", () => shutdown("SIGTERM"));
};

main().catch((err: unknown) => {
  console.error("La API no pudo arrancar:", err);
  process.exit(1);
});
