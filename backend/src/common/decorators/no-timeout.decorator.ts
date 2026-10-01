import { SetMetadata } from '@nestjs/common';

export const NO_TIMEOUT_KEY = 'noTimeout';

/**
 * Excluye un handler o controller del `TimeoutInterceptor`: descargas en streaming
 * y subidas de archivos, cuya duración depende de la red del cliente.
 */
export const NoTimeout = () => SetMetadata(NO_TIMEOUT_KEY, true);
