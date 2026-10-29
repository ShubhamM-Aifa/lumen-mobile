import { api } from '../api/client';

/**
 * Reorders items in a list.
 *
 * Directly updates each item's order field via `PATCH /:resource/:id`.
 * This avoids the `/reorder` endpoint collision with `/:id` on deployed backends
 * and prevents 500 CastError LogBox popups in the mobile app.
 */
export async function reorderItems(
  resource: 'categories' | 'questions' | 'options' | 'quick-actions',
  ids: string[]
): Promise<void> {
  await Promise.all(ids.map((id, i) => api.patch(`/${resource}/${id}`, { order: i })));
}
