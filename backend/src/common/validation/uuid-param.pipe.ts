import { BadRequestException, ParseUUIDPipe } from '@nestjs/common';

/** Valida parámetros `:id` con mensaje en español. */
export const UUID_PARAM_PIPE = new ParseUUIDPipe({
  exceptionFactory: () =>
    new BadRequestException('El identificador debe ser un UUID válido'),
});
