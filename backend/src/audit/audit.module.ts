import { Module } from '@nestjs/common';
import { AuditLogsRepository } from './audit-logs.repository.js';
import { AuditService } from './audit.service.js';

@Module({
  providers: [AuditService, AuditLogsRepository],
  exports: [AuditService],
})
export class AuditModule {}
