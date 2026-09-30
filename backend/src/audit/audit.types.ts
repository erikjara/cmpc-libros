import type { AuditAction } from '../generated/prisma/client.js';
import type { RequestContext } from '../common/types/request-context.js';

export type AuditEntity = 'Book' | 'User';

export interface AuditEntry {
  action: AuditAction;
  entity: AuditEntity;
  entityId: string | null;
  context: RequestContext;
  changes?: Record<string, unknown>;
}
