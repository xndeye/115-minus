import { isObject } from '@/core/validation';
import { validateAria2RpcUrl } from '@/platform/aria2';
import { validateIdmClientId } from '@/platform/idm';

export interface Settings {
  aria2RpcUrl: string;
  aria2Secret: string;
  idmClientId: string;
  webFullscreen: boolean;
}

const DEFAULT_SETTINGS: Settings = {
  aria2RpcUrl: 'http://127.0.0.1:6800/jsonrpc',
  aria2Secret: '',
  idmClientId: '1',
  webFullscreen: true,
};

const parseSettings = (stored: unknown): Settings => {
  if (!isObject(stored)) {
    return { ...DEFAULT_SETTINGS };
  }
  return {
    aria2RpcUrl:
      typeof stored.aria2RpcUrl === 'string' ? stored.aria2RpcUrl : DEFAULT_SETTINGS.aria2RpcUrl,
    aria2Secret:
      typeof stored.aria2Secret === 'string' ? stored.aria2Secret : DEFAULT_SETTINGS.aria2Secret,
    idmClientId:
      typeof stored.idmClientId === 'string' ? stored.idmClientId : DEFAULT_SETTINGS.idmClientId,
    webFullscreen:
      typeof stored.webFullscreen === 'boolean'
        ? stored.webFullscreen
        : DEFAULT_SETTINGS.webFullscreen,
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
