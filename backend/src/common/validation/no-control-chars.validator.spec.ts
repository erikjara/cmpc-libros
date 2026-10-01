import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { describe, expect, it } from 'vitest';
import { CreateBookDto } from '../../books/dto/create-book.dto.js';
import { BookListQueryDto } from '../../books/dto/book-list-query.dto.js';
import { flattenValidationErrors } from './validation-exception.factory.js';
import {
  hasControlChars,
  NoControlChars,
} from './no-control-chars.validator.js';

class Sample {
  @NoControlChars()
  text: unknown;
}

class Labeled {
  @NoControlChars('El título')
  text: unknown;
}

async function messagesFor<T extends object>(
  type: new () => T,
  plain: object,
): Promise<string[]> {
  return flattenValidationErrors(await validate(plainToInstance(type, plain)));
}

describe('hasControlChars', () => {
  it.each([
    ['NUL', 'a\u0000b', true],
    ['U+0001', '\u0001', true],
    ['escape U+001B', 'x\u001b[31m', true],
    ['DEL U+007F', 'abc\u007f', true],
    ['control C1 U+0085', 'a\u0085b', true],
    ['control C1 U+009F', '\u009f', true],
    ['tabulación', 'a\tb', false],
    ['salto de línea', 'línea 1\nlínea 2', false],
    ['retorno de carro', 'a\r\nb', false],
    ['tab vertical y avance de página', 'a\u000bb\u000cc', false],
    ['texto con tildes y ñ', 'Ñuñoa: García Márquez, Sepúlveda', false],
    ['espacio duro y emoji', 'a b 📚', false],
    ['texto vacío', '', false],
  ])('%s → %s', (_name, value, expected) => {
    expect(hasControlChars(value)).toBe(expected);
  });
});

describe('@NoControlChars', () => {
  it('rechaza con el mensaje por defecto', async () => {
    expect(await messagesFor(Sample, { text: 'a\u0000b' })).toEqual([
      'El texto contiene caracteres no permitidos',
    ]);
  });

  it('usa la etiqueta del campo en el mensaje', async () => {
    expect(await messagesFor(Labeled, { text: '\u007f' })).toEqual([
      'El título contiene caracteres no permitidos',
    ]);
  });

  it('acepta texto normal y deja los valores que no son string a @IsString', async () => {
    expect(await messagesFor(Sample, { text: 'Niño García' })).toEqual([]);
    expect(await messagesFor(Sample, { text: 42 })).toEqual([]);
    expect(await messagesFor(Sample, {})).toEqual([]);
  });
});

describe('DTOs con @NoControlChars', () => {
  const validBook = {
    title: 'Cien años de soledad',
    authorName: 'Gabriel García Márquez',
    publisherName: 'Sudamericana',
    genreName: 'Novela',
    price: 15990,
    stock: 3,
  };

  it.each([
    ['title', 'El título'],
    ['authorName', 'El autor'],
    ['publisherName', 'La editorial'],
    ['genreName', 'El género'],
  ])('CreateBookDto rechaza NUL en %s', async (field, label) => {
    expect(
      await messagesFor(CreateBookDto, { ...validBook, [field]: 'a\u0000b' }),
    ).toEqual([`${label} contiene caracteres no permitidos`]);
  });

  it('CreateBookDto acepta tabs y saltos de línea (normalizeSpaces los colapsa antes)', async () => {
    const plain = { ...validBook, title: 'Cien\taños\nde  soledad' };
    expect(await messagesFor(CreateBookDto, plain)).toEqual([]);
    expect(plainToInstance(CreateBookDto, plain).title).toBe(
      'Cien años de soledad',
    );
  });

  it('BookListQueryDto rechaza NUL en search y acepta tildes', async () => {
    expect(await messagesFor(BookListQueryDto, { search: 'a\u0000b' })).toEqual(
      ['search contiene caracteres no permitidos'],
    );
    expect(await messagesFor(BookListQueryDto, { search: 'García' })).toEqual(
      [],
    );
  });
});
