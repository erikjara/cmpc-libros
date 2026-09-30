import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { escapeLike } from '../books/book-query.js';

export type CatalogKind = 'author' | 'publisher' | 'genre';

export interface CatalogItem {
  id: string;
  name: string;
}

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
