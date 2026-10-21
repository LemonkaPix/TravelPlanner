import * as DocumentPicker from 'expo-document-picker';

import { MAX_PLAN_FILE_BYTES, planFileName, PlanTransferError } from './planTransfer';

export async function pickPlansFile(): Promise<string | null> {
  const result = await DocumentPicker.getDocumentAsync({ type: '*/*', multiple: false, base64: false });
  if (result.canceled) return null;
  const asset = result.assets[0];
  try {
    const file = asset.file;
    if (!file) throw new PlanTransferError('Nie udało się odczytać wybranego pliku.');
    if (file.size > MAX_PLAN_FILE_BYTES) throw new PlanTransferError('Plik jest za duży. Wybierz plik planów o rozmiarze do 8 MB.');
    return await file.text();
  } finally {
    URL.revokeObjectURL(asset.uri);
  }
}

export async function exportPlansFile(content: string): Promise<void> {
  const url = URL.createObjectURL(new Blob([content], { type: 'application/json;charset=utf-8' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = planFileName();
  document.body.appendChild(link);
  try {
    link.click();
  } finally {
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
  }
}
