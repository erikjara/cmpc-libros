import { existsSync } from 'node:fs';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ConfigService } from '@nestjs/config';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { Env } from '../config/env.schema.js';
import { detectImageType } from './image-type.js';
import { LocalDiskStorageService } from './local-disk-storage.service.js';
import {
  JPEG_BYTES,
  PNG_BYTES,
  WEBP_BYTES,
} from '../testing/image-fixtures.js';

describe('detectImageType', () => {
  it('reconoce JPEG, PNG y WebP por su firma', () => {
    expect(detectImageType(JPEG_BYTES)).toBe('jpg');
    expect(detectImageType(PNG_BYTES)).toBe('png');
    expect(detectImageType(WEBP_BYTES)).toBe('webp');
  });

  it('rechaza otros formatos aunque se llamen .jpg', () => {
    expect(detectImageType(Buffer.from('GIF89a'))).toBeNull();
    expect(detectImageType(Buffer.from('%PDF-1.7'))).toBeNull();
    expect(detectImageType(Buffer.from('RIFF0000WAVE'))).toBeNull();
    expect(detectImageType(Buffer.alloc(0))).toBeNull();
  });
});

describe('LocalDiskStorageService', () => {
  let directory: string;
  let storage: LocalDiskStorageService;

  beforeEach(async () => {
    directory = await mkdtemp(join(tmpdir(), 'cmpc-uploads-'));
    const config = {
      get: () => join(directory, 'nested'),
    } as unknown as ConfigService<Env, true>;
    storage = new LocalDiskStorageService(config);
  });

  afterEach(async () => {
    await rm(directory, { recursive: true, force: true });
  });

  it('guarda el archivo con nombre UUID y la extensión indicada', async () => {
    const key = await storage.save(PNG_BYTES, 'png');

    expect(key).toMatch(/^[0-9a-f-]{36}\.png$/);
    await expect(readFile(join(directory, 'nested', key))).resolves.toEqual(
      PNG_BYTES,
    );
  });

  it('elimina un archivo existente y tolera uno inexistente', async () => {
    const key = await storage.save(JPEG_BYTES, 'jpg');

    await storage.delete(key);
    expect(existsSync(join(directory, 'nested', key))).toBe(false);
    await expect(storage.delete(key)).resolves.toBeUndefined();
  });

  it('rechaza claves que intentan salir del directorio', async () => {
    await expect(storage.delete('../../etc/passwd')).rejects.toThrow(
      'Clave de almacenamiento inválida',
    );
  });
});
