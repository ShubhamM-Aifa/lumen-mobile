/**
 * Before a log is submitted: finds all image-type FieldValues, uploads each
 * local URI via the media pipeline, and replaces the value with the returned
 * mediaId array. Returns the mutated answers array.
 *
 * Uploads that fail are left as local URIs with a warning so the log is not
 * blocked. The media upload queue will retry them later.
 */
import { Answer } from '@lumen/shared';
import { uploadMedia, getMimeType } from '../services/mediaUpload';
import { useAuthStore } from '../store/authStore';

export async function uploadAnswerImages(answers: Answer[]): Promise<Answer[]> {
  const user = useAuthStore.getState().user;
  const hasPhotoPin = Boolean(user?.hasPhotoPin);
  const result: Answer[] = [];
  for (const ans of answers) {
    const optLabel = (ans.optionLabelSnapshot || '').toLowerCase();
    const values = await Promise.all(
      (ans.values ?? []).map(async v => {
        if (v.dataType !== 'image') return v;
        const fieldKey = (v.fieldKey || '').toLowerCase();
        const isSensitive =
          hasPhotoPin ||
          optLabel.includes('stool') ||
          optLabel.includes('flare') ||
          optLabel.includes('skin') ||
          optLabel.includes('wound') ||
          optLabel.includes('sensitive') ||
          fieldKey.includes('stool') ||
          fieldKey.includes('skin') ||
          fieldKey.includes('flare') ||
          fieldKey.includes('sensitive');

        const uris: string[] = Array.isArray(v.value)
          ? v.value.map(String)
          : typeof v.value === 'string' && v.value.trim().length > 0
            ? [v.value.trim()]
            : [];
        const mediaIds: string[] = [];

        for (const uri of uris) {
          const trimmed = uri.trim();
          if (!trimmed) continue;

          // Check if already an uploaded server mediaId (Mongo ObjectId / UUID) or remote URL
          const isMongoId = /^[0-9a-fA-F]{24}$/.test(trimmed);
          const isUuid = /^[0-9a-fA-F-]{36}$/.test(trimmed);
          const isRemoteUrl =
            (trimmed.startsWith('http://') || trimmed.startsWith('https://')) &&
            !trimmed.startsWith('http://localhost') &&
            !trimmed.startsWith('http://127.0.0.1');

          if (isMongoId || isUuid || isRemoteUrl) {
            mediaIds.push(trimmed);
            continue;
          }

          // Local file (file://, content://, ph://, blob:, etc.) -> upload
          try {
            const mime = getMimeType(trimmed);
            const res = await uploadMedia(trimmed, mime, isSensitive);
            mediaIds.push(res.mediaId);
          } catch (err) {
            console.warn('[uploadAnswerImages] upload failed for URI:', trimmed, err);
            // Keep local URI as fallback — queue will retry
            mediaIds.push(trimmed);
          }
        }
        return { ...v, value: mediaIds };
      }),
    );
    result.push({ ...ans, values });
  }
  return result;
}
