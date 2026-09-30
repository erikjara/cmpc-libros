import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { Injectable, Logger } from '@nestjs/common';
import { stringify } from 'csv-stringify';
import { AuditService } from '../audit/audit.service.js';
import type { RequestContext } from '../common/types/request-context.js';
import { PrismaService } from '../prisma/prisma.service.js';
import {
  buildBookQuery,
  type BookFilters,
  type BookQuery,
} from './book-query.js';
import { BooksRepository } from './books.repository.js';
import { CSV_COLUMNS, toCsvRow, type CsvRow } from './csv.js';

export const EXPORT_BATCH_SIZE = 500;

@Injectable()
export class BooksExportService {
  private readonly logger = new Logger(BooksExportService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly repository: BooksRepository,
    private readonly audit: AuditService,
  ) {}

  /**
   * Valida filtros, registra EXPORT y devuelve un stream CSV (BOM UTF-8) que
   * lee la base de datos por lotes, sin cargar todo el inventario en memoria.
   */
  async createCsvStream(
    filters: BookFilters,
    context: RequestContext,
  ): Promise<Readable> {
    const query = buildBookQuery(filters);
    await this.audit.record(this.prisma, {
      action: 'EXPORT',
      entity: 'Book',
      entityId: null,
      context,
      changes: { filters: { ...filters } },
    });

    const csv = stringify({
      header: true,
      bom: true,
      columns: [...CSV_COLUMNS],
    });
    pipeline(Readable.from(this.rows(query)), csv).catch((error: unknown) => {
      this.logger.error(`Falló la exportación CSV: ${String(error)}`);
    });
    return csv;
  }

  private async *rows({ where, orderBy }: BookQuery): AsyncGenerator<CsvRow> {
    let cursor: string | undefined;
    for (;;) {
      const batch = await this.repository.findBatch({
        where,
        orderBy,
        take: EXPORT_BATCH_SIZE,
        cursor,
      });
      for (const book of batch) {
        yield toCsvRow(book);
      }
      if (batch.length < EXPORT_BATCH_SIZE) {
        return;
      }
      cursor = batch[batch.length - 1].id;
    }
  }
}
