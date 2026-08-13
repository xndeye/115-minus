import { isObject } from '@/core/validation';
import { validateAria2RpcUrl } from '@/platform/aria2';
import { validateIdmClientId } from '@/platform/idm';

export interface Settings {
  aria2RpcUrl: string;
  aria2Secret: string;
  idmClientId: string;
}

export const DEFAULT_SETTINGS: Settings = {
  aria2RpcUrl: 'http://127.0.0.1:6800/jsonrpc',
  aria2Secret: '',
  idmClientId: '1',
};

const directString = (value: Record<string, unknown>, key: keyof Settings): string | undefined => {
  const direct = value[key];
  return typeof direct === 'string' ? direct : undefined;
};

const parseSettings = (stored: unknown): Settings => {
  if (!isObject(stored)) {
    return { ...DEFAULT_SETTINGS };
  }
  return {
    aria2RpcUrl: directString(stored, 'aria2RpcUrl') ?? DEFAULT_SETTINGS.aria2RpcUrl,
    aria2Secret: directString(stored, 'aria2Secret') ?? DEFAULT_SETTINGS.aria2Secret,
    idmClientId: directString(stored, 'idmClientId') ?? DEFAULT_SETTINGS.idmClientId,
  };
};

export const settings: Readonly<Settings> = Object.freeze(
  parseSettings(GM_getValue<unknown>('settings', null)),
);

export const saveSettings = (value: Settings): void => {
  validateAria2RpcUrl(value.aria2RpcUrl);
  validateIdmClientId(value.idmClientId);
  GM_setValue('settings', value);
};
