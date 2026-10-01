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
import { BooksRepository, type BookWithRelations } from './books.repository.js';
import { CSV_COLUMNS, CSV_DELIMITER, toCsvRow, type CsvRow } from './csv.js';

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
   * Valida filtros, lee el primer lote, registra EXPORT y devuelve un stream CSV (BOM
   * UTF-8, `;` como separador) que sigue leyendo por lotes, sin cargar todo el inventario en memoria.
   * El primer lote se lee antes de responder: si la base falla, el error llega al filtro
   * global como un 500 con el formato de error de la API, en vez de un CSV vacío.
   */
  async createCsvStream(
    filters: BookFilters,
    context: RequestContext,
  ): Promise<Readable> {
    const query = buildBookQuery(filters);
    const firstBatch = await this.fetchBatch(query);
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
      delimiter: CSV_DELIMITER,
      columns: [...CSV_COLUMNS],
    });
    // Un error de un lote posterior destruye `csv` con ese mismo error y lo maneja quien
    // consume el stream (el controller corta la descarga). Si el consumidor lo destruye
    // (cliente desconectado), la lectura de lotes se detiene.
    pipeline(Readable.from(this.rows(query, firstBatch)), csv).catch(
      (error: unknown) => {
        this.logger.debug(`Exportación CSV interrumpida: ${String(error)}`);
      },
    );
    return csv;
  }

  private fetchBatch(
    { where, orderBy }: BookQuery,
    cursor?: string,
  ): Promise<BookWithRelations[]> {
    return this.repository.findBatch({
      where,
      orderBy,
      take: EXPORT_BATCH_SIZE,
      cursor,
    });
  }

  private async *rows(
    query: BookQuery,
    firstBatch: BookWithRelations[],
  ): AsyncGenerator<CsvRow> {
    let batch = firstBatch;
    for (;;) {
      for (const book of batch) {
        yield toCsvRow(book);
      }
      if (batch.length < EXPORT_BATCH_SIZE) {
        return;
      }
      batch = await this.fetchBatch(query, batch[batch.length - 1].id);
    }
  }
}
