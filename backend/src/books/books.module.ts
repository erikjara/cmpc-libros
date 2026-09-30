import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module.js';
import { BooksExportService } from './books-export.service.js';
import { BooksController } from './books.controller.js';
import { BooksRepository } from './books.repository.js';
import { BooksService } from './books.service.js';

@Module({
  imports: [AuditModule],
  controllers: [BooksController],
  providers: [BooksService, BooksRepository, BooksExportService],
})
export class BooksModule {}
