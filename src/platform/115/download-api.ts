import { ApplicationError } from '@/core/errors';
import { requestTextWithRetry } from '@/core/http';
import {
  isObject,
  parseObject,
  requireObject,
  requireNumber,
  requireString,
  optionalString,
} from '@/core/validation';
import { decodeDownloadResponse, encodeDownloadRequest } from '@/platform/115/download-codec';
import type { StorageEntry } from '@/platform/115/storage-entry';

export interface DownloadLink {
  name: string;
  pickCode: string;
  url: string;
}

const FOLDER_PAGE_SIZE = 1_000;

const readFileEntry = (value: unknown): StorageEntry => {
  const operation = '读取文件夹内容';
  if (!isObject(value)) {
    throw new ApplicationError(operation, '文件条目不是对象');
  }
  const name = requireString(value, 'n', operation);
  const pickCode = requireString(value, 'pc', operation);
  const fileId = optionalString(value, 'fid');
  const directoryId = optionalString(value, 'cid');
  if (!fileId && !directoryId) {
    throw new ApplicationError(operation, `文件条目“${name}”缺少文件或目录 ID`);
  }
  return {
    directoryId,
    isDirectory: !fileId,
    name,
    pickCode,
    size: fileId ? requireNumber(value, 's', operation) : 0,
  };
};

interface StorageEntryPage {
  entries: StorageEntry[];
  total: number;
}

const listFolderPage = async (directoryId: string, offset: number): Promise<StorageEntryPage> => {
  const operation = '读取文件夹内容';
  const response = await requestTextWithRetry({
    operation,
    method: 'GET',
    url: `https://webapi.115.com/files?aid=1&cid=${encodeURIComponent(directoryId)}&show_dir=1&offset=${offset}&limit=${FOLDER_PAGE_SIZE}&format=json`,
  });
  const json = parseObject(response.body, operation);
  if (json.state !== true) {
    throw new ApplicationError(operation, optionalString(json, 'error') || '115 返回失败状态');
  }
  if (!Array.isArray(json.data)) {
    throw new ApplicationError(operation, '响应字段 data 不是数组');
  }
  return {
    entries: json.data.map(readFileEntry),
    total: requireNumber(json, 'count', operation),
  };
};

export const listFolder = async (directoryId: string): Promise<StorageEntry[]> => {
  const operation = '读取文件夹内容';
  const entries: StorageEntry[] = [];
  const pickCodes = new Set<string>();
  let offset = 0;

  while (true) {
    const page = await listFolderPage(directoryId, offset);
    for (const entry of page.entries) {
      if (!pickCodes.has(entry.pickCode)) {
        pickCodes.add(entry.pickCode);
        entries.push(entry);
      }
    }
    if (entries.length >= page.total) {
      return entries;
    }
    if (page.entries.length === 0) {
      throw new ApplicationError(
        operation,
        `目录 ${directoryId} 分页提前结束，预期 ${page.total} 项，实际读取 ${entries.length} 项`,
      );
    }
    offset += page.entries.length;
  }
};

export const getDownloadLink = async (pickCode: string): Promise<DownloadLink> => {
  const operation = '获取文件下载地址';
  const timestamp = Math.floor(Date.now() / 1000);
  const encoded = encodeDownloadRequest(pickCode, timestamp);
  const response = await requestTextWithRetry({
    operation,
    method: 'POST',
    url: `http://proapi.115.com/app/chrome/downurl?t=${timestamp}`,
    data: `data=${encodeURIComponent(encoded.data)}`,
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
  });
  const json = parseObject(response.body, operation);
  if (json.state !== true) {
    throw new ApplicationError(
      operation,
      optionalString(json, 'msg') || optionalString(json, 'error') || '115 返回失败状态',
    );
  }
  const encrypted = requireString(json, 'data', operation);
  const decoded = parseObject(decodeDownloadResponse(encrypted, encoded.key), operation);
  const first = Object.values(decoded)[0];
  if (!isObject(first)) {
    throw new ApplicationError(operation, '解密响应中没有文件信息');
  }
  const urlObject = requireObject(first, 'url', operation);
  return {
    name: requireString(first, 'file_name', operation),
    pickCode: requireString(first, 'pick_code', operation),
    url: requireString(urlObject, 'url', operation),
  };
};
