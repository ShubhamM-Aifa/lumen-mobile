/** Layout of a chat photo message: how many tiles to show, and how many are hidden behind "+N". */
export interface GridPhoto {
  photoUrl?: string;
  photoMediaId?: string;
  width?: number;
  height?: number;
  isGif?: boolean;
}

export const MAX_PHOTOS_PER_MESSAGE = 10;

/** Photos of a message, old single-photo messages included. */
export function messagePhotos(embedType: string | undefined, embedData: any): GridPhoto[] {
  if (!embedData) return [];
  if (embedType === 'gif' && embedData.gifUrl) {
    return [{ photoUrl: embedData.gifUrl, width: embedData.width, height: embedData.height, isGif: true }];
  }
  if (embedType !== 'photo') return [];
  if (Array.isArray(embedData.photos) && embedData.photos.length) {
    return embedData.photos.filter((p: GridPhoto) => p && p.photoUrl);
  }
  return embedData.photoUrl ? [{ photoUrl: embedData.photoUrl, photoMediaId: embedData.photoMediaId }] : [];
}

/** Rows of tile indexes: 1 → [0]; 2 → [0,1]; 3 → [0],[1,2]; 4+ → [0,1],[2,3] with the rest as "+N". */
export function gridRows(count: number): { rows: number[][]; hidden: number } {
  if (count <= 0) return { rows: [], hidden: 0 };
  if (count === 1) return { rows: [[0]], hidden: 0 };
  if (count === 2) return { rows: [[0, 1]], hidden: 0 };
  if (count === 3) return { rows: [[0], [1, 2]], hidden: 0 };
  return { rows: [[0, 1], [2, 3]], hidden: count - 4 };
}

/** Height for a single photo at `maxWidth`, keeping its shape but never taller than `maxHeight`. */
export function singleSize(w: number | undefined, h: number | undefined, maxWidth = 260, maxHeight = 320): { width: number; height: number } {
  if (!w || !h || w <= 0 || h <= 0) return { width: maxWidth, height: maxWidth };
  const ratio = h / w;
  const height = Math.min(maxHeight, Math.round(maxWidth * ratio));
  const width = height === maxHeight ? Math.round(maxHeight / ratio) : maxWidth;
  return { width: Math.max(120, width), height: Math.max(90, height) };
}
