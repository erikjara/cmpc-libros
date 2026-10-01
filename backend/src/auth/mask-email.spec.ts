import { describe, expect, it } from 'vitest';
import { maskEmail } from './mask-email.js';

describe('maskEmail', () => {
  it.each([
    ['admin@cmpc.cl', 'a***@cmpc.cl'],
    ['a@cmpc.cl', 'a***@cmpc.cl'],
    ['sin-arroba', '***'],
    ['', '***'],
  ])('enmascara %j como %j', (input, expected) => {
    expect(maskEmail(input)).toBe(expected);
  });
});
