/**
 * Client-side MongoDB ObjectId (24 hex chars). Tasks, lists, groups and categories get their final id
 * the moment they are created, so there are no temporary ids to swap and edits made before the
 * first sync can never target an id the server doesn't know.
 */
let counter = Math.floor(Math.random() * 0xffffff);

function hex(n: number, width: number): string {
  return n.toString(16).padStart(width, '0').slice(-width);
}

export function newObjectId(now: number = Date.now()): string {
  counter = (counter + 1) % 0x1000000;
  const seconds = Math.floor(now / 1000);
  const rand = hex(Math.floor(Math.random() * 0x100000000), 8) + hex(Math.floor(Math.random() * 0x100), 2);
  return hex(seconds, 8) + rand + hex(counter, 6);
}

export function isObjectId(value: unknown): value is string {
  return typeof value === 'string' && /^[0-9a-fA-F]{24}$/.test(value);
}
