/**
 * API 统一入口 — 运行时自动检测 Electron / Web 环境
 */
import type { QAQAPI } from '../types';
import { createElectronApi } from './electron-api';
import { createWebApi } from './web-api';

let _api: QAQAPI | null = null;

export function getApi(): QAQAPI {
  if (!_api) {
    _api = typeof window !== 'undefined' && window.electronAPI
      ? createElectronApi()
      : createWebApi();
  }
  return _api;
}

/** 便捷导出 */
export const api: QAQAPI = new Proxy({} as QAQAPI, {
  get(_target, prop) {
    return (getApi() as any)[prop];
  },
});
