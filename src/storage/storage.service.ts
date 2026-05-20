import { Injectable, Logger } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import { Readable, Writable } from 'stream';

@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name);
  private readonly storageBasePath = path.join(process.cwd(), 'data_storage');

  constructor() {
    if (!fs.existsSync(this.storageBasePath)) {
      fs.mkdirSync(this.storageBasePath, { recursive: true });
    }
  }

  /**
   * Sanitizes a string to be safe for use as a Windows/Linux filename.
   * Removes or replaces characters that are illegal in file paths.
   */
  private sanitizeFilename(filename: string): string {
    // Replace characters invalid on Windows (<>:"/\|?*) and leading/trailing spaces/dots
    return filename
      .replace(/[<>:"\/\\|?*\x00-\x1f]/g, '_')
      .replace(/^[\s.]+|[\s.]+$/g, '')
      .substring(0, 200); // limit length
  }

  /**
   * Returns a writable stream to save chunks to disk.
   * Supports file resumption by checking file size if appending.
   */
  createWriteStream(filename: string, append = false): Writable {
    const safe = this.sanitizeFilename(filename);
    const filePath = path.join(this.storageBasePath, safe);
    const flags = append ? 'a' : 'w';
    
    this.logger.debug(`Opening write stream for ${filePath} with flags: ${flags}`);
    return fs.createWriteStream(filePath, { flags });
  }

  /**
   * Returns a readable stream, useful for Range requests or outbound processing.
   */
  createReadStream(filename: string, start?: number, end?: number): Readable {
    const safe = this.sanitizeFilename(filename);
    const filePath = path.join(this.storageBasePath, safe);
    const options: any = {};
    
    if (start !== undefined) options.start = start;
    if (end !== undefined) options.end = end;

    return fs.createReadStream(filePath, options);
  }

  /**
   * Gets file stats for resumption logic (HTTP Range).
   */
  getFileStats(filename: string): fs.Stats | null {
    const filePath = path.join(this.storageBasePath, filename);
    try {
      return fs.statSync(filePath);
    } catch (e) {
      return null;
    }
  }
}
