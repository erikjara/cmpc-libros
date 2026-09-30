import { beforeEach, describe, expect, it } from 'vitest';
import {
  mock,
  mockDeep,
  type DeepMockProxy,
  type MockProxy,
} from 'vitest-mock-extended';
import type { PrismaService } from '../prisma/prisma.service.js';
import { CatalogController } from './catalog.controller.js';
import { CatalogRepository } from './catalog.repository.js';

describe('CatalogRepository', () => {
  let prisma: DeepMockProxy<PrismaService>;
  let repository: CatalogRepository;

  beforeEach(() => {
    prisma = mockDeep<PrismaService>();
    repository = new CatalogRepository(prisma);
  });

  it('busca autores por nombre, sin distinguir mayúsculas, ordenados y limitados', async () => {
    prisma.author.findMany.mockResolvedValue([
      { id: 'a1', name: 'Isabel Allende' },
    ] as never);

    await expect(
      repository.search('author', { search: 'allen', limit: 5 }),
    ).resolves.toEqual([{ id: 'a1', name: 'Isabel Allende' }]);
    expect(prisma.author.findMany).toHaveBeenCalledWith({
      where: { name: { contains: 'allen', mode: 'insensitive' } },
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
      take: 5,
    });
  });

  it('sin search lista todo y escapa comodines cuando hay search', async () => {
    await repository.search('publisher', { limit: 20 });
    expect(prisma.publisher.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: {} }),
    );

    await repository.search('genre', { search: '100%', limit: 20 });
    expect(prisma.genre.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { name: { contains: '100\\%', mode: 'insensitive' } },
      }),
    );
  });
});

describe('CatalogController', () => {
  let repository: MockProxy<CatalogRepository>;
  let controller: CatalogController;

  beforeEach(() => {
    repository = mock<CatalogRepository>();
    repository.search.mockResolvedValue([]);
    controller = new CatalogController(repository);
  });

  it('cada ruta consulta su catálogo', async () => {
    const query = { search: 'a', limit: 20 };
    await controller.authors(query);
    await controller.publishers(query);
    await controller.genres(query);
    expect(repository.search.mock.calls.map(([kind]) => kind)).toEqual([
      'author',
      'publisher',
      'genre',
    ]);
  });
});
