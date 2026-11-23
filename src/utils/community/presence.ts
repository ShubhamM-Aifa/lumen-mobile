/** "online", "last seen today at 10:42", or nothing when the person hides it (or you do). */
export function presenceText(isOnline: boolean | undefined, lastSeenAt: string | null | undefined, now: Date = new Date()): string | null {
  if (isOnline) return 'online';
  if (isOnline === undefined || !lastSeenAt) return null; // unknown or never seen: say nothing rather than guess
  const d = new Date(lastSeenAt);
  if (Number.isNaN(d.getTime())) return null;
  const time = d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  const startOf = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const days = Math.round((startOf(now) - startOf(d)) / 86_400_000);
  if (days <= 0) return `last seen today at ${time}`;
  if (days === 1) return `last seen yesterday at ${time}`;
  if (days < 7) return `last seen ${d.toLocaleDateString([], { weekday: 'long' })} at ${time}`;
  return `last seen ${d.toLocaleDateString([], { month: 'short', day: 'numeric' })}`;
}
