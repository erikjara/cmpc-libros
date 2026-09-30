import { BadRequestException } from '@nestjs/common';
import type { ArgumentMetadata } from '@nestjs/common';
import type { ValidationError } from 'class-validator';
import { describe, expect, it } from 'vitest';
import { UUID_PARAM_PIPE } from './uuid-param.pipe.js';
import {
  flattenValidationErrors,
  validationExceptionFactory,
} from './validation-exception.factory.js';

const paramMetadata: ArgumentMetadata = { type: 'param', data: 'id' };

describe('flattenValidationErrors', () => {
  it('devuelve los mensajes de cada restricción', () => {
    const errors = [
      {
        property: 'title',
        constraints: { isLength: 'El título es obligatorio' },
      },
    ] as ValidationError[];
    expect(flattenValidationErrors(errors)).toEqual([
      'El título es obligatorio',
    ]);
  });

  it('traduce las propiedades no permitidas', () => {
    const errors = [
      {
        property: 'foo',
        constraints: { whitelistValidation: 'property foo should not exist' },
      },
    ] as ValidationError[];
    expect(flattenValidationErrors(errors)).toEqual([
      'La propiedad "foo" no está permitida',
    ]);
  });

  it('recorre errores anidados con la ruta completa', () => {
    const errors = [
      {
        property: 'author',
        children: [
          {
            property: 'x',
            constraints: { whitelistValidation: 'no' },
            children: [],
          },
        ],
      },
    ] as unknown as ValidationError[];
    expect(flattenValidationErrors(errors)).toEqual([
      'La propiedad "author.x" no está permitida',
    ]);
  });
});

describe('validationExceptionFactory', () => {
  it('crea un 400 con la lista de mensajes', () => {
    const exception = validationExceptionFactory([
      {
        property: 'price',
        constraints: { min: 'El precio no puede ser negativo' },
      },
    ] as ValidationError[]);
    expect(exception).toBeInstanceOf(BadRequestException);
    expect(exception.getResponse()).toMatchObject({
      message: ['El precio no puede ser negativo'],
    });
  });
});

describe('UUID_PARAM_PIPE', () => {
  it('acepta un UUID válido', async () => {
    const id = '3f2b8a54-5f0e-4f7c-9a57-3a5f9b2f6e10';
    await expect(UUID_PARAM_PIPE.transform(id, paramMetadata)).resolves.toBe(
      id,
    );
  });

  it('rechaza un identificador inválido con mensaje en español', async () => {
    await expect(
      UUID_PARAM_PIPE.transform('abc', paramMetadata),
    ).rejects.toThrow('El identificador debe ser un UUID válido');
  });
});
