import type { Prisma } from '../generated/prisma/client.js';

/**
 * Cliente de base de datos que aceptan los repositorios: el `PrismaService`
 * o el `tx` de una transacción interactiva.
 */
export type DbClient = Prisma.TransactionClient;
