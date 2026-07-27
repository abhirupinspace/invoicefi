import fs from 'fs/promises';
import path from 'path';
import { env } from '../../config/env';

// Storage abstraction. The MVP writes to local disk but the interface is shaped
// so an IPFS or S3 backed provider can be dropped in without touching callers.
export interface StoredObject {
  // A stable reference. For local storage this is a relative file path; for
  // IPFS it would be a CID URI.
  path: string;
  size: number;
}

export interface StorageProvider {
  readonly driver: string;
  save(key: string, data: Buffer): Promise<StoredObject>;
  read(reference: string): Promise<Buffer>;
  remove(reference: string): Promise<void>;
}

class LocalStorageProvider implements StorageProvider {
  readonly driver = 'local';
  private readonly baseDir: string;

  constructor(baseDir: string) {
    this.baseDir = path.isAbsolute(baseDir)
      ? baseDir
      : path.resolve(process.cwd(), baseDir);
  }

  private resolve(reference: string): string {
    const full = path.resolve(this.baseDir, reference);
    // Guard against path traversal outside the storage root.
    if (!full.startsWith(this.baseDir)) {
      throw new Error('Invalid storage reference');
    }
    return full;
  }

  async save(key: string, data: Buffer): Promise<StoredObject> {
    const full = this.resolve(key);
    await fs.mkdir(path.dirname(full), { recursive: true });
    await fs.writeFile(full, data);
    return { path: key, size: data.length };
  }

  async read(reference: string): Promise<Buffer> {
    return fs.readFile(this.resolve(reference));
  }

  async remove(reference: string): Promise<void> {
    await fs.rm(this.resolve(reference), { force: true });
  }
}

function createStorage(): StorageProvider {
  switch (env.STORAGE_DRIVER) {
    case 'local':
    default:
      return new LocalStorageProvider(env.STORAGE_DIR);
  }
}

export const storage = createStorage();
