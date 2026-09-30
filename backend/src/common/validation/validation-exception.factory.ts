import { BadRequestException } from '@nestjs/common';
import type { ValidationError } from 'class-validator';

export function flattenValidationErrors(
  errors: ValidationError[],
  parentPath = '',
): string[] {
  return errors.flatMap((error) => {
    const path = parentPath
      ? `${parentPath}.${error.property}`
      : error.property;
    const own = Object.entries(error.constraints ?? {}).map(
      ([rule, message]) =>
        rule === 'whitelistValidation'
          ? `La propiedad "${path}" no está permitida`
          : message,
    );
    return [...own, ...flattenValidationErrors(error.children ?? [], path)];
  });
}

export function validationExceptionFactory(
  errors: ValidationError[],
): BadRequestException {
  return new BadRequestException(flattenValidationErrors(errors));
}
