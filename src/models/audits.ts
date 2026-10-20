export type AuditRow = { id: number; userId: number; username: string; method: string; resource: string; detail: string | null; aiSuggested: boolean; createdAt: Date };

export type AuditResponse = Omit<AuditRow, "createdAt"> & { createdAt: string };

export const toAuditResponse = (row: AuditRow): AuditResponse => ({ ...row, createdAt: row.createdAt.toISOString() });

export type NewAudit = { userId: number; method: string; resource: string; detail?: string | null; aiSuggested?: boolean };

/** Métodos que no son escrituras HTTP: generación de reportes y accesos. */
export const AuditMethods = { EXPORT: "EXPORT", SIGNIN: "SIGNIN" } as const;

export type AuditListFilter = { userId?: number | undefined; resource?: string | undefined; method?: string | undefined; from?: string | undefined; to?: string | undefined };
