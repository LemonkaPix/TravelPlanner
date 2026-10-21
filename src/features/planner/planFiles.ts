import * as DocumentPicker from 'expo-document-picker';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';

import { MAX_PLAN_FILE_BYTES, PlanTransferError } from './planTransfer';

export async function pickPlansFile(): Promise<string | null> {
  const result = await DocumentPicker.getDocumentAsync({ type: '*/*', multiple: false, copyToCacheDirectory: true });
  if (result.canceled) return null;
  const file = new File(result.assets[0].uri);
  try {
    if (file.size > MAX_PLAN_FILE_BYTES) throw new PlanTransferError('Plik jest za duży. Wybierz plik planów o rozmiarze do 8 MB.');
    return await file.text();
  } finally {
    if (file.exists) file.delete();
  }
}

export async function exportPlansFile(content: string): Promise<void> {
  if (!await Sharing.isAvailableAsync()) throw new PlanTransferError('Udostępnianie plików nie jest dostępne na tym urządzeniu.');
  // Keep one cached export: a receiving app may read it after the share sheet closes.
  const file = new File(Paths.cache, 'travelplanner-plany.json');
  file.create({ overwrite: true });
  file.write(content);
  await Sharing.shareAsync(file.uri, { mimeType: 'application/json', UTI: 'public.json', dialogTitle: 'Eksport planów' });
}
