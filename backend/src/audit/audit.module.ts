import { Module } from '@nestjs/common';
import { AuditLogsController } from './audit-logs.controller.js';
import { AuditLogsRepository } from './audit-logs.repository.js';
import { AuditService } from './audit.service.js';

@Module({
  controllers: [AuditLogsController],
  providers: [AuditService, AuditLogsRepository],
  exports: [AuditService],
})
export class AuditModule {}
