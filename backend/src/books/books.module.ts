import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module.js';
import { BooksController } from './books.controller.js';
import { BooksRepository } from './books.repository.js';
import { BooksService } from './books.service.js';

@Module({
  imports: [AuditModule],
  controllers: [BooksController],
  providers: [BooksService, BooksRepository],
})
export class BooksModule {}
