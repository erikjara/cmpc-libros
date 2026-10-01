import { ValidateBy, type ValidationOptions } from 'class-validator';

/**
 * Caracteres de control (categoría Unicode Cc: U+0000–U+001F y U+007F–U+009F) salvo los
 * espacios en blanco \t \n \v \f \r, que `normalizeSpaces` / `toSearchKey` convierten en
 * espacios. Incluye NUL (U+0000), que PostgreSQL no admite en columnas de texto (22021).
 */
const CONTROL_CHAR = /(?![\t\n\v\f\r])\p{Cc}/u;

export function hasControlChars(value: string): boolean {
  return CONTROL_CHAR.test(value);
}

/**
 * Rechaza strings con caracteres de control (400 "<campo> contiene caracteres no
 * permitidos"). Los valores que no son string pasan: los valida `@IsString`.
 */
export function NoControlChars(
  label = 'El texto',
  options?: ValidationOptions,
): PropertyDecorator {
  return ValidateBy(
    {
      name: 'noControlChars',
      validator: {
        validate: (value: unknown) =>
          typeof value !== 'string' || !hasControlChars(value),
        defaultMessage: () => `${label} contiene caracteres no permitidos`,
      },
    },
    options,
  );
}
