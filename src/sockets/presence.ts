import type { PersonSummary } from "../models/index";

/**
 * Presencia en memoria: usuario → conjunto de sockets. Un usuario con varias pestañas
 * sigue «en línea» hasta que se cierra la última. Vive en el proceso de la API
 * (una sola instancia en Seenode); con varias instancias se movería a Redis.
 */
type Entry = { person: PersonSummary; sockets: Set<string> };

const online = new Map<number, Entry>();

/** Registra un socket; devuelve true si es la primera conexión del usuario. */
export const addSocket = (person: PersonSummary, socketId: string): boolean => {
  const entry = online.get(person.id);
  if (entry !== undefined) {
    entry.sockets.add(socketId);
    entry.person = person;
    return false;
  }
  online.set(person.id, { person, sockets: new Set([socketId]) });
  return true;
};

/** Quita un socket; devuelve true si era el último del usuario (pasa a desconectado). */
export const removeSocket = (userId: number, socketId: string): boolean => {
  const entry = online.get(userId);
  if (entry === undefined) return false;
  entry.sockets.delete(socketId);
  if (entry.sockets.size > 0) return false;
  online.delete(userId);
  return true;
};

export const listOnline = (): PersonSummary[] =>
  [...online.values()].map((e) => e.person).sort((a, b) => a.name.localeCompare(b.name, "es"));

export const isOnline = (userId: number): boolean => online.has(userId);

/** Solo para pruebas. */
export const clearPresence = (): void => online.clear();
