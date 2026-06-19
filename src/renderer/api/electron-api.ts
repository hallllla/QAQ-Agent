/**
 * Electron IPC 通道 — 封装 window.electronAPI
 */
import type { QAQAPI } from '../types';

export function createElectronApi(): QAQAPI {
  return window.electronAPI;
}
