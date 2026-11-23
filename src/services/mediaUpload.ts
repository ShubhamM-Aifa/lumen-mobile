/**
 * Media upload pipeline.
 * Flow: POST /media/upload-url → PUT presigned URL → POST /media/confirm
 * Failed uploads are queued in AsyncStorage and retried on next call to flushQueue().
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { api } from '../api/client';

const QUEUE_KEY = 'lumen:media:queue';

export interface UploadResult {
  mediaId: string;
  url: string;
}

interface QueueItem {
  localUri: string;
  mimeType: string;
  sensitive: boolean;
  resolve: string; // stringified callback key — not persistent; items added to queue lose their resolve
}

async function loadQueue(): Promise<Omit<QueueItem, 'resolve'>[]> {
  try {
    const raw = await AsyncStorage.getItem(QUEUE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

async function saveQueue(items: Omit<QueueItem, 'resolve'>[]): Promise<void> {
  try { await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(items)); } catch {}
}

export async function uploadMedia(
  localUri: string,
  mimeType: string,
  sensitive = false,
  /** Bytes, when known (documents): lets the server enforce its size limit. */
  size?: number,
): Promise<UploadResult> {
  // 1. Get pre-signed URL
  const uploadInfo = await api.post<any>('/media/upload-url', { mimeType, sensitive, ...(size ? { size } : {}) });
  const mediaId = uploadInfo?.mediaId || uploadInfo?.data?.mediaId;
  const uploadUrl = uploadInfo?.uploadUrl || uploadInfo?.data?.uploadUrl;

  // 2. Upload to storage
  const blob = await (await fetch(localUri)).blob();
  const putRes = await fetch(uploadUrl, {
    method: 'PUT',
    headers: { 'Content-Type': mimeType },
    body: blob,
  });
  if (!putRes.ok) throw new Error(`Storage upload failed: ${putRes.status}`);

  // 3. Confirm
  const confirmRes = await api.post<any>('/media/confirm', { mediaId, ...(size ? { size } : {}) });
  return { mediaId, url: confirmRes?.url || confirmRes?.data?.url || '' };
}

export async function uploadMediaWithRetry(
  localUri: string,
  mimeType: string,
  sensitive = false,
): Promise<UploadResult | null> {
  try {
    return await uploadMedia(localUri, mimeType, sensitive);
  } catch {
    // Queue for later retry
    const queue = await loadQueue();
    queue.push({ localUri, mimeType, sensitive });
    await saveQueue(queue);
    return null;
  }
}

export async function flushQueue(): Promise<void> {
  const queue = await loadQueue();
  if (queue.length === 0) return;
  const remaining: Omit<QueueItem, 'resolve'>[] = [];
  for (const item of queue) {
    try {
      await uploadMedia(item.localUri, item.mimeType, item.sensitive);
    } catch {
      remaining.push(item);
    }
  }
  await saveQueue(remaining);
}

export function getMimeType(uri: string): string {
  if (uri.startsWith('data:image/')) {
    const match = uri.match(/^data:(image\/[a-zA-Z0-9.+-]+);/);
    if (match) return match[1];
  }
  const cleanUri = uri.split('?')[0].split('#')[0];
  const ext = cleanUri.split('.').pop()?.toLowerCase() ?? '';
  const map: Record<string, string> = {
    jpg: 'image/jpeg', jpeg: 'image/jpeg',
    png: 'image/png', webp: 'image/webp', heic: 'image/heic', heif: 'image/heif', gif: 'image/gif',
    mp4: 'video/mp4', mov: 'video/quicktime',
    pdf: 'application/pdf',
  };
  return map[ext] ?? 'image/jpeg';
}
