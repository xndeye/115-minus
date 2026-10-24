import { ApplicationError } from '@/core/errors';
import { requestTextWithRetry } from '@/core/http';
import {
  isObject,
  parseObject,
  requireObject,
  requireNonNegativeInteger,
  requireArray,
  requireString,
  optionalString,
} from '@/core/validation';
import { decodeDownloadResponse, encodeDownloadRequest } from '@/platform/115/download-codec';
import { readStorageEntry, type StorageEntry } from '@/platform/115/storage-entry';

export interface DownloadLink {
  name: string;
  pickCode: string;
  url: string;
}

const FOLDER_PAGE_SIZE = 1_000;

interface StorageEntryPage {
  entries: StorageEntry[];
  total: number;
}

const listFolderPage = async (
  directoryId: string,
  offset: number,
  signal: AbortSignal,
): Promise<StorageEntryPage> => {
  const operation = '读取文件夹内容';
  const response = await requestTextWithRetry({
    operation,
    method: 'GET',
    signal,
    url: `https://webapi.115.com/files?aid=1&cid=${encodeURIComponent(directoryId)}&show_dir=1&offset=${offset}&limit=${FOLDER_PAGE_SIZE}&format=json`,
  });
  const json = parseObject(response.body, operation);
  if (json.state !== true) {
    throw new ApplicationError(operation, optionalString(json, 'error') || '115 返回失败状态');
  }
  return {
    entries: requireArray(json, 'data', operation).map(readStorageEntry),
    total: requireNonNegativeInteger(json, 'count', operation),
  };
};

export const listFolder = async (
  directoryId: string,
  signal: AbortSignal,
): Promise<StorageEntry[]> => {
  const operation = '读取文件夹内容';
  const entries = new Map<string, StorageEntry>();
  let offset = 0;

  while (true) {
    const page = await listFolderPage(directoryId, offset, signal);
    const previousSize = entries.size;
    for (const entry of page.entries) {
      entries.set(`${entry.isDirectory}:${entry.id}`, entry);
    }
    if (entries.size >= page.total) {
      return [...entries.values()];
    }
    offset += page.entries.length;
    if (entries.size === previousSize || offset >= page.total) {
      throw new ApplicationError(
        operation,
        `目录 ${directoryId} 分页不完整，预期 ${page.total} 项，实际读取 ${entries.size} 项，请重新读取`,
      );
    }
  }
};

export const getDownloadLink = async (
  pickCode: string,
  signal: AbortSignal,
): Promise<DownloadLink> => {
  const operation = '获取文件下载地址';
  const timestamp = Math.floor(Date.now() / 1000);
  const encoded = encodeDownloadRequest(pickCode, timestamp);
  const response = await requestTextWithRetry({
    operation,
    method: 'POST',
    signal,
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
  if (requireString(first, 'pick_code', operation) !== pickCode) {
    throw new ApplicationError(operation, '响应文件提取码与请求不一致');
  }
  const url = new URL(requireString(urlObject, 'url', operation));
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new ApplicationError(operation, `下载地址协议无效：${url.protocol}`);
  }
  return {
    name: requireString(first, 'file_name', operation),
    pickCode,
    url: url.href,
  };
};
