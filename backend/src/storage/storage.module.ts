import { Module } from '@nestjs/common';
import { LocalDiskStorageService } from './local-disk-storage.service.js';
import { STORAGE_SERVICE } from './storage.service.js';

@Module({
  providers: [{ provide: STORAGE_SERVICE, useClass: LocalDiskStorageService }],
  exports: [STORAGE_SERVICE],
})
export class StorageModule {}
