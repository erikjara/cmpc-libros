import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { describe, expect, it } from 'vitest';
import { flattenValidationErrors } from '../../common/validation/validation-exception.factory.js';
import { BookListQueryDto } from './book-list-query.dto.js';
import { CreateBookDto } from './create-book.dto.js';
import { TrashQueryDto } from './trash-query.dto.js';
import { UpdateBookDto } from './update-book.dto.js';

async function errorsFor<T extends object>(
  type: new () => T,
  plain: object,
): Promise<string[]> {
  const instance = plainToInstance(type, plain);
  return flattenValidationErrors(
    await validate(instance, { whitelist: true, forbidNonWhitelisted: true }),
  );
}

const validBook = {
  title: 'Rayuela',
  authorName: 'Julio Cortázar',
  publisherName: 'Alfaguara',
  genreName: 'Novela',
  price: 23990,
  stock: 0,
};

describe('CreateBookDto', () => {
  it('acepta un libro válido y recorta espacios', async () => {
    expect(
      await errorsFor(CreateBookDto, { ...validBook, title: '  Rayuela  ' }),
    ).toEqual([]);
    expect(
      plainToInstance(CreateBookDto, { ...validBook, title: '  Rayuela  ' })
        .title,
    ).toBe('Rayuela');
  });

  it('colapsa espacios internos en título y nombres de catálogo', () => {
    const dto = plainToInstance(CreateBookDto, {
      ...validBook,
      title: ' Rayuela \n  (edición   crítica) ',
      authorName: '  Julio   Cortázar ',
      publisherName: 'Alfaguara\t\tEditores',
      genreName: 'Novela\n corta',
    });
    expect(dto).toMatchObject({
      title: 'Rayuela (edición crítica)',
      authorName: 'Julio Cortázar',
      publisherName: 'Alfaguara Editores',
      genreName: 'Novela corta',
    });
  });

  it('rechaza nombres de catálogo con solo espacios en blanco', async () => {
    const errors = await errorsFor(CreateBookDto, {
      ...validBook,
      authorName: ' \t ',
      publisherName: '\n',
      genreName: '   ',
    });
    expect(errors).toEqual(
      expect.arrayContaining([
        'El autor debe tener entre 1 y 120 caracteres',
        'La editorial debe tener entre 1 y 120 caracteres',
        'El género debe tener entre 1 y 120 caracteres',
      ]),
    );
  });

  it('rechaza título en blanco, precio con 3 decimales y stock negativo o decimal', async () => {
    const errors = await errorsFor(CreateBookDto, {
      ...validBook,
      title: '   ',
      price: 1.234,
      stock: -1.5,
    });
    expect(errors).toContain('El título debe tener entre 1 y 200 caracteres');
    expect(errors).toContain(
      'El precio debe ser un número con máximo 2 decimales',
    );
    expect(errors).toContain('El stock debe ser un número entero');
    expect(errors).toContain('El stock no puede ser negativo');
  });

  it('rechaza precio como string y campos desconocidos', async () => {
    const errors = await errorsFor(CreateBookDto, {
      ...validBook,
      price: '100',
      isbn: 'x',
    });
    expect(errors).toContain(
      'El precio debe ser un número con máximo 2 decimales',
    );
    expect(errors).toContain('La propiedad "isbn" no está permitida');
  });
});

describe('UpdateBookDto', () => {
  it('permite enviar un solo campo', async () => {
    expect(await errorsFor(UpdateBookDto, { stock: 5 })).toEqual([]);
  });

  it('rechaza null en vez de ignorarlo', async () => {
    expect(await errorsFor(UpdateBookDto, { title: null })).toContain(
      'El título es obligatorio',
    );
  });
});

describe('BookListQueryDto', () => {
  it('convierte page/limit y trata filtros vacíos como ausentes', async () => {
    const query = plainToInstance(BookListQueryDto, {
      page: '2',
      limit: '25',
      search: '   ',
      authorId: '',
    });
    expect(await validate(query)).toEqual([]);
    expect(query).toMatchObject({ page: 2, limit: 25 });
    expect(query.search).toBeUndefined();
    expect(query.authorId).toBeUndefined();
  });

  it('usa page=1 y limit=10 por defecto', () => {
    expect(plainToInstance(BookListQueryDto, {})).toMatchObject({
      page: 1,
      limit: 10,
    });
  });

  it('rechaza limit > 100, page 0 y available inválido', async () => {
    const errors = await errorsFor(BookListQueryDto, {
      limit: '101',
      page: '0',
      available: 'si',
    });
    expect(errors).toContain('limit no puede ser mayor a 100');
    expect(errors).toContain('page debe ser mayor o igual a 1');
    expect(errors).toContain("available debe ser 'true' o 'false'");
  });

  it('rechaza page mayor a 1.000.000 (evita un offset fuera de rango en la BD)', async () => {
    expect(await errorsFor(BookListQueryDto, { page: '1000000' })).toEqual([]);
    expect(await errorsFor(BookListQueryDto, { page: '1e20' })).toContain(
      'page no puede ser mayor a 1000000',
    );
  });
});

describe('TrashQueryDto', () => {
  it('usa page=1 y limit=10 por defecto y trata la búsqueda vacía como ausente', async () => {
    const query = plainToInstance(TrashQueryDto, { search: '   ' });
    expect(await validate(query)).toEqual([]);
    expect(query).toMatchObject({ page: 1, limit: 10 });
    expect(query.search).toBeUndefined();
  });

  it('convierte page/limit y recorta la búsqueda', async () => {
    const query = plainToInstance(TrashQueryDto, {
      page: '2',
      limit: '25',
      search: '  allende ',
    });
    expect(await validate(query)).toEqual([]);
    expect(query).toMatchObject({ page: 2, limit: 25, search: 'allende' });
  });

  it('rechaza límites fuera de rango y una búsqueda de más de 100 caracteres', async () => {
    const errors = await errorsFor(TrashQueryDto, {
      page: '1000001',
      limit: '101',
      search: 'x'.repeat(101),
    });
    expect(errors).toContain('page no puede ser mayor a 1000000');
    expect(errors).toContain('limit no puede ser mayor a 100');
    expect(errors).toContain('search debe tener entre 1 y 100 caracteres');
  });

  it('rechaza los filtros y el orden del listado (parámetros desconocidos)', async () => {
    const errors = await errorsFor(TrashQueryDto, {
      sort: 'title:asc',
      authorId: '3f2b8a54-5f0e-4f7c-9a57-3a5f9b2f6e10',
    });
    expect(errors).toContain('La propiedad "sort" no está permitida');
    expect(errors).toContain('La propiedad "authorId" no está permitida');
  });
});
