// 対局の記録を JSON で書き出す。ブラウザ版はファイルとして保存し、スマホ版は共有メニューで送る

import { Platform, Share } from 'react-native';
import type { GameLog } from '@ritual/engine';

export function logFileName(log: GameLog): string {
  return `ritual-log-${log.startedAt.replace(/[:.]/g, '-')}.json`;
}

export async function exportLog(log: GameLog): Promise<void> {
  const json = JSON.stringify(log, null, 2);
  if (Platform.OS === 'web') {
    const url = URL.createObjectURL(new Blob([json], { type: 'application/json' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = logFileName(log);
    a.click();
    URL.revokeObjectURL(url);
    return;
  }
  await Share.share({ title: logFileName(log), message: json });
}
