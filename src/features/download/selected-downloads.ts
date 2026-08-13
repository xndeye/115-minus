import { addAria2Uri, type Aria2Config } from '@/platform/aria2';
import { getDownloadLink, listFolder, type DownloadLink } from '@/platform/115/download-api';
import type { StorageEntry } from '@/platform/115/storage-entry';
import { addIdmDownload, type IdmConfig } from '@/platform/idm';

const CONCURRENCY = 4;

const collectFiles = async (selected: StorageEntry[]): Promise<StorageEntry[]> => {
  const files = selected.filter((entry) => !entry.isDirectory);
  let directories = selected.filter((entry) => entry.isDirectory);

  while (directories.length > 0) {
    const nextDirectories: StorageEntry[] = [];
    for (let offset = 0; offset < directories.length; offset += CONCURRENCY) {
      const batch = directories.slice(offset, offset + CONCURRENCY);
      const children = await Promise.all(batch.map((entry) => listFolder(entry.directoryId)));
      children.flat().forEach((entry) => {
        if (entry.isDirectory) {
          nextDirectories.push(entry);
        } else {
          files.push(entry);
        }
      });
    }
    directories = nextDirectories;
  }

  return Array.from(new Map(files.map((file) => [file.pickCode, file])).values());
};

const processSelected = async (
  selected: StorageEntry[],
  handleLink: (link: DownloadLink, file: StorageEntry) => void | Promise<void>,
): Promise<number> => {
  const files = await collectFiles(selected);
  for (let offset = 0; offset < files.length; offset += CONCURRENCY) {
    const batch = files.slice(offset, offset + CONCURRENCY);
    await Promise.all(
      batch.map(async (file) => {
        const link = await getDownloadLink(file.pickCode);
        await handleLink(link, file);
      }),
    );
  }
  return files.length;
};

export const pushSelectedToAria2 = (
  selected: StorageEntry[],
  config: Aria2Config,
): Promise<number> =>
  processSelected(selected, (link) => addAria2Uri(config, link).then(() => undefined));

export const pushSelectedToIdm = (selected: StorageEntry[], config: IdmConfig): Promise<number> =>
  processSelected(selected, (link, file) => addIdmDownload(config, link, file.size));
