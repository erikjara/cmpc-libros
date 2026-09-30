import type { ImageExtension } from './image-type.js';

export const STORAGE_SERVICE = Symbol('STORAGE_SERVICE');

/** Almacenamiento de archivos. Cambiar a S3 es agregar otra implementación. */
export interface StorageService {
  /** Guarda el contenido y devuelve la clave generada (`<uuid>.<ext>`). */
  save(content: Buffer, extension: ImageExtension): Promise<string>;
  /** Elimina el archivo; no falla si ya no existe. */
  delete(key: string): Promise<void>;
}

/** Archivo recibido por multer (memoryStorage). */
export interface UploadedImage {
  buffer: Buffer;
  mimetype: string;
  size: number;
  originalname: string;
}
