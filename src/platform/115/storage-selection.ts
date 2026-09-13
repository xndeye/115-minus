import { ApplicationError } from '@/core/errors';
import type { StorageEntry } from '@/platform/115/storage-entry';

interface StoragePageFile {
  cid?: string;
  fid?: string;
  file_type?: string;
  n?: string;
  name?: string;
  pc?: string;
  s?: number | string;
  size?: number | string;
  type?: string;
}

interface ReactFiber {
  memoizedProps?: {
    file?: StoragePageFile;
  };
  return: ReactFiber | null;
}

const isFiber = (value: unknown): value is ReactFiber =>
  typeof value === 'object' && value !== null && 'return' in value;

const readPageFile = (checkbox: HTMLInputElement): StoragePageFile => {
  const key = Object.keys(checkbox).find((item) => item.startsWith('__reactFiber$'));
  const value: unknown = key ? Reflect.get(checkbox, key) : undefined;
  let fiber = isFiber(value) ? value : undefined;
  while (fiber && !fiber.memoizedProps?.file) {
    fiber = fiber.return ?? undefined;
  }
  if (!fiber?.memoizedProps?.file) {
    throw new ApplicationError('读取文件信息', '115 页面组件结构已变化，无法获取文件信息');
  }
  return fiber.memoizedProps.file;
};

const normalizePageFile = (file: StoragePageFile): StorageEntry => {
  const operation = '读取文件信息';
  const name = file.n ?? file.name;
  const pickCode = file.pc;
  const isDirectory = file.type === 'folder' || file.file_type === 'folder' || !file.fid;
  if (!name || !pickCode) {
    throw new ApplicationError(operation, '文件名称或提取码为空');
  }
  if (isDirectory && !file.cid) {
    throw new ApplicationError(operation, `文件夹“${name}”缺少目录 ID`);
  }
  const rawSize = file.s ?? file.size;
  const size = typeof rawSize === 'string' && rawSize !== '' ? Number(rawSize) : rawSize;
  let fileSize = 0;
  if (!isDirectory && (typeof size !== 'number' || !Number.isFinite(size) || size < 0)) {
    throw new ApplicationError(operation, `文件“${name}”缺少有效大小`);
  }
  if (typeof size === 'number') {
    fileSize = size;
  }
  return {
    directoryId: isDirectory ? (file.cid ?? '') : '',
    isDirectory,
    name,
    pickCode,
    size: fileSize,
  };
};

export const getSelectedFiles = (): StorageEntry[] =>
  Array.from(
    document.querySelectorAll<HTMLInputElement>(
      '.file-list-wrap .checkbox-area input[type="checkbox"]:checked',
    ),
    (checkbox) => normalizePageFile(readPageFile(checkbox)),
  );

export const findFileItemDownloadButton = (
  target: EventTarget | null,
): HTMLButtonElement | null => {
  const button =
    target instanceof Element
      ? target.closest<HTMLButtonElement>(
          '.file-list-item [data-menu-action="download"] > button',
        )
      : null;
  return button instanceof HTMLButtonElement ? button : null;
};

export const getFileFromListItem = (target: Element): StorageEntry => {
  const item = target.closest<HTMLElement>('.file-list-item[data-file-id]');
  if (!item) {
    throw new ApplicationError('读取列表项文件', '下载入口不在文件列表项中');
  }
  const checkbox = item.querySelector<HTMLInputElement>(
    '.checkbox-area input[type="checkbox"]',
  );
  if (!checkbox) {
    throw new ApplicationError('读取列表项文件', '列表项中不存在文件复选框');
  }
  return normalizePageFile(readPageFile(checkbox));
};

export const getSelectedFileCount = (): number =>
  document.querySelectorAll('.file-list-wrap .checkbox-area input[type="checkbox"]:checked').length;
