import { Injectable } from '@nestjs/common';
import type { CatalogItem } from '../common/types/catalog-item.js';
import { CatalogRepository, type CatalogSearch } from './catalog.repository.js';

@Injectable()
export class CatalogService {
  constructor(private readonly repository: CatalogRepository) {}

  authors(query: CatalogSearch): Promise<CatalogItem[]> {
    return this.repository.search('author', query);
  }

  publishers(query: CatalogSearch): Promise<CatalogItem[]> {
    return this.repository.search('publisher', query);
  }

  genres(query: CatalogSearch): Promise<CatalogItem[]> {
    return this.repository.search('genre', query);
  }
}
