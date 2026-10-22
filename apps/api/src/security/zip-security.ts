import { BadRequestException } from '@nestjs/common';
import { fromBuffer, type Entry } from 'yauzl';

/** Bound both declared and actual ZIP expansion before ExcelJS allocates XML. */
export async function validateWorkbookZip(buffer: Buffer): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    fromBuffer(
      buffer,
      { lazyEntries: true, validateEntrySizes: true },
      (error, zip) => {
        if (error || !zip) {
          reject(new BadRequestException('File Excel không hợp lệ.'));
          return;
        }
        let entries = 0;
        let total = 0;
        let finished = false;
        let stream: import('node:stream').Readable | undefined;
        const finish = (failed: boolean) => {
          if (finished) return;
          finished = true;
          clearTimeout(timer);
          stream?.destroy();
          zip.close();
          if (failed)
            reject(
              new BadRequestException(
                'File Excel không hợp lệ hoặc vượt giới hạn giải nén (20 MiB, 200 mục).',
              ),
            );
          else resolve();
        };
        const timer = setTimeout(() => finish(true), 10000);
        zip.on('error', () => finish(true));
        zip.on('end', () => finish(entries === 0));
        zip.on('entry', (entry: Entry) => {
          if (
            ++entries > 200 ||
            entry.uncompressedSize > 20 * 1024 * 1024 ||
            entry.generalPurposeBitFlag & 1 ||
            entry.fileName.includes('..')
          ) {
            finish(true);
            return;
          }
          if (entry.fileName.endsWith('/')) {
            zip.readEntry();
            return;
          }
          zip.openReadStream(entry, (streamError, readable) => {
            if (finished) {
              readable?.destroy();
              return;
            }
            if (streamError || !readable) {
              finish(true);
              return;
            }
            stream = readable;
            readable.on('error', () => finish(true));
            readable.on('data', (chunk: Buffer) => {
              total += chunk.length;
              if (total > 20 * 1024 * 1024) finish(true);
            });
            readable.on('end', () => {
              if (!finished) zip.readEntry();
            });
          });
        });
        zip.readEntry();
      },
    );
  });
}
