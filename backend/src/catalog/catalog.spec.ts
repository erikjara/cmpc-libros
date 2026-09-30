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
import { CatalogService } from './catalog.service.js';

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

describe('CatalogService', () => {
  let repository: MockProxy<CatalogRepository>;
  let service: CatalogService;

  beforeEach(() => {
    repository = mock<CatalogRepository>();
    service = new CatalogService(repository);
  });

  it('consulta cada catálogo en el repositorio con la búsqueda y el límite', async () => {
    const items = [{ id: 'a1', name: 'Isabel Allende' }];
    repository.search.mockResolvedValue(items);
    const query = { search: 'all', limit: 5 };

    await expect(service.authors(query)).resolves.toBe(items);
    await service.publishers(query);
    await service.genres(query);

    expect(repository.search.mock.calls).toEqual([
      ['author', query],
      ['publisher', query],
      ['genre', query],
    ]);
  });
});

describe('CatalogController', () => {
  let service: MockProxy<CatalogService>;
  let controller: CatalogController;

  beforeEach(() => {
    service = mock<CatalogService>();
    service.authors.mockResolvedValue([]);
    service.publishers.mockResolvedValue([]);
    service.genres.mockResolvedValue([]);
    controller = new CatalogController(service);
  });

  it('cada ruta delega en el service', async () => {
    const query = { search: 'a', limit: 20 };
    await controller.authors(query);
    await controller.publishers(query);
    await controller.genres(query);
    expect(service.authors).toHaveBeenCalledWith(query);
    expect(service.publishers).toHaveBeenCalledWith(query);
    expect(service.genres).toHaveBeenCalledWith(query);
  });
});
