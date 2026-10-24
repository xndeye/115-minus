import { addAria2Uri, type Aria2Config } from '@/platform/aria2';
import { getDownloadLink, listFolder, type DownloadLink } from '@/platform/115/download-api';
import type { StorageEntry, StorageFile, StorageDirectory } from '@/platform/115/storage-entry';
import { addIdmDownload, type IdmConfig } from '@/platform/idm';
import { errorMessage } from '@/core/errors';

const CONCURRENCY = 4;

export interface TransferFailure {
  file: StorageFile;
  message: string;
}

export interface TransferResult {
  succeeded: number;
  failed: TransferFailure[];
}

const collectFiles = async (
  selected: readonly StorageEntry[],
  signal: AbortSignal,
): Promise<StorageFile[]> => {
  const files = new Map(
    selected.filter((entry) => !entry.isDirectory).map((file) => [file.pickCode, file]),
  );
  let directories = selected.filter((entry) => entry.isDirectory);
  const visited = new Set<string>();

  while (directories.length > 0) {
    const nextDirectories: StorageDirectory[] = [];
    for (let offset = 0; offset < directories.length; offset += CONCURRENCY) {
      const batch = directories.slice(offset, offset + CONCURRENCY).filter((entry) => {
        if (visited.has(entry.id)) return false;
        visited.add(entry.id);
        return true;
      });
      const results = await Promise.allSettled(batch.map((entry) => listFolder(entry.id, signal)));
      signal.throwIfAborted();
      const errors: unknown[] = results.flatMap((result) =>
        result.status === 'rejected' ? [result.reason] : [],
      );
      if (errors.length > 0) {
        throw new AggregateError(errors, `读取文件夹失败：${errors.map(errorMessage).join('；')}`);
      }
      const children = results.flatMap((result) =>
        result.status === 'fulfilled' ? result.value : [],
      );
      children.forEach((entry) => {
        if (entry.isDirectory) {
          nextDirectories.push(entry);
        } else {
          files.set(entry.pickCode, entry);
        }
      });
    }
    directories = nextDirectories;
  }

  return [...files.values()];
};

const processSelected = async (
  selected: readonly StorageEntry[],
  handleLink: (link: DownloadLink, file: StorageFile) => Promise<unknown>,
  signal: AbortSignal,
): Promise<TransferResult> => {
  if (selected.length === 0) {
    throw new Error('请选择需要推送的文件或文件夹');
  }
  const files = await collectFiles(selected, signal);
  const failed: TransferFailure[] = [];
  for (let offset = 0; offset < files.length; offset += CONCURRENCY) {
    const batch = files.slice(offset, offset + CONCURRENCY);
    const results = await Promise.all(
      batch.map(async (file): Promise<TransferFailure | null> => {
        try {
          const link = await getDownloadLink(file.pickCode, signal);
          signal.throwIfAborted();
          await handleLink(link, file);
          return null;
        } catch (error) {
          if (!signal.aborted) {
            console.error('115- 推送文件失败', { pickCode: file.pickCode, name: file.name, error });
          }
          return { file, message: errorMessage(error) };
        }
      }),
    );
    signal.throwIfAborted();
    failed.push(...results.filter((result): result is TransferFailure => result !== null));
  }
  return { succeeded: files.length - failed.length, failed };
};

export const pushSelectedToAria2 = (
  selected: readonly StorageEntry[],
  config: Aria2Config,
  signal: AbortSignal,
): Promise<TransferResult> =>
  processSelected(selected, (link) => addAria2Uri(config, link), signal);

export const pushSelectedToIdm = (
  selected: readonly StorageEntry[],
  config: IdmConfig,
  signal: AbortSignal,
): Promise<TransferResult> =>
  processSelected(
    selected,
    (link, file) => addIdmDownload(config, link, file.size, signal),
    signal,
  );
