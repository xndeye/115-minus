import { ApplicationError } from '@/core/errors';
import {
  isObject,
  requireIdentifier,
  requireNonNegativeInteger,
  requireString,
} from '@/core/validation';

interface Entry {
  id: string;
  name: string;
}

export interface StorageFile extends Entry {
  isDirectory: false;
  pickCode: string;
  size: number;
}

export interface StorageDirectory extends Entry {
  isDirectory: true;
}

export type StorageEntry = StorageFile | StorageDirectory;

export const readStorageEntry = (value: unknown): StorageEntry => {
  const operation = '读取文件信息';
  if (!isObject(value)) {
    throw new ApplicationError(operation, '文件条目不是对象');
  }
  const isDirectory = value.type === 'folder' || value.file_type === 'folder' || !value.fid;
  const fields = {
    id: isDirectory ? value.cid : value.fid,
    name: value.n ?? value.name,
    pickCode: value.pc,
    size: value.s ?? value.size,
  };
  const entry = {
    id: requireIdentifier(fields, 'id', operation),
    name: requireString(fields, 'name', operation),
  };
  if (isDirectory) {
    return { ...entry, isDirectory: true };
  }
  return {
    ...entry,
    isDirectory: false,
    pickCode: requireString(fields, 'pickCode', operation),
    size: requireNonNegativeInteger(fields, 'size', operation),
  };
};
