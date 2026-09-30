import { Injectable } from '@nestjs/common';
import { escapeLike } from '../books/book-query.js';
import type { CatalogItem } from '../common/types/catalog-item.js';
import { PrismaService } from '../prisma/prisma.service.js';

export type CatalogKind = 'author' | 'publisher' | 'genre';

export interface CatalogSearch {
  search?: string;
  limit: number;
}

@Injectable()
export class CatalogRepository {
  constructor(private readonly prisma: PrismaService) {}

  search(
    kind: CatalogKind,
    { search, limit }: CatalogSearch,
  ): Promise<CatalogItem[]> {
    const args = {
      where: search
        ? {
            name: {
              contains: escapeLike(search),
              mode: 'insensitive' as const,
            },
          }
        : {},
      select: { id: true, name: true },
      orderBy: { name: 'asc' as const },
      take: limit,
    };
    switch (kind) {
      case 'author':
        return this.prisma.author.findMany(args);
      case 'publisher':
        return this.prisma.publisher.findMany(args);
      case 'genre':
        return this.prisma.genre.findMany(args);
    }
  }
}
