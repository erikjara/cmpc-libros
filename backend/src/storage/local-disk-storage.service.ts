import { randomUUID } from 'node:crypto';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Env } from '../config/env.schema.js';
import type { ImageExtension } from './image-type.js';
import type { StorageService } from './storage.service.js';

const STORAGE_KEY_PATTERN = /^[0-9a-f-]{36}\.(jpg|png|webp)$/;

@Injectable()
export class LocalDiskStorageService implements StorageService {
  private readonly directory: string;

  constructor(config: ConfigService<Env, true>) {
    this.directory = resolve(config.get('UPLOADS_DIR', { infer: true }));
  }

  async save(content: Buffer, extension: ImageExtension): Promise<string> {
    await mkdir(this.directory, { recursive: true });
    const key = `${randomUUID()}.${extension}`;
    await writeFile(join(this.directory, key), content, { flag: 'wx' });
    return key;
  }

  async delete(key: string): Promise<void> {
    if (!STORAGE_KEY_PATTERN.test(key)) {
      throw new Error(`Clave de almacenamiento inválida: ${key}`);
    }
    await rm(join(this.directory, key), { force: true });
  }
}
