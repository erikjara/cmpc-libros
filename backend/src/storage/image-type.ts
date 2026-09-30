export type ImageExtension = 'jpg' | 'png' | 'webp';

export const MAX_IMAGE_BYTES = 2 * 1024 * 1024;

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

function startsWith(buffer: Buffer, bytes: number[], offset = 0): boolean {
  return bytes.every((byte, index) => buffer[offset + index] === byte);
}

/**
 * Detecta el formato real por la firma binaria ("magic bytes"), sin confiar
 * en la extensión ni en el Content-Type que envía el cliente.
 */
export function detectImageType(buffer: Buffer): ImageExtension | null {
  if (startsWith(buffer, [0xff, 0xd8, 0xff])) {
    return 'jpg';
  }
  if (startsWith(buffer, PNG_SIGNATURE)) {
    return 'png';
  }
  if (
    buffer.subarray(0, 4).toString('ascii') === 'RIFF' &&
    buffer.subarray(8, 12).toString('ascii') === 'WEBP'
  ) {
    return 'webp';
  }
  return null;
}
