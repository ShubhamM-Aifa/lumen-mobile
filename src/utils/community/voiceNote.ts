/** The upload type for a recorded voice note, from its file name (native m4a, web webm). */
export function voiceNoteMimeType(uri: string): string {
  const ext = (uri.split('?')[0].split('.').pop() || '').toLowerCase();
  if (ext === 'webm') return 'audio/webm';
  if (ext === 'wav') return 'audio/wav';
  if (ext === 'mp3') return 'audio/mpeg';
  if (ext === 'aac') return 'audio/aac';
  if (ext === '3gp') return 'audio/3gpp';
  return 'audio/mp4'; // .m4a and anything unknown on native (the recorder writes MPEG-4 AAC)
}

export const PLAYBACK_RATES = [1, 1.5, 2] as const;
export function nextRate(rate: number): number {
  const i = PLAYBACK_RATES.indexOf(rate as 1);
  return PLAYBACK_RATES[(i + 1) % PLAYBACK_RATES.length];
}
