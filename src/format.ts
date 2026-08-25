// Small formatting helpers shared by screens. No dates beyond "today" cleverness: this app is used
// where clocks drift, so labels stay simple and honest.

/** "14:32" for today, "Aug 24" otherwise. Falls back to a dash-free placeholder when unknown. */
export function timeLabel(at: number | undefined, now: number = Date.now()): string {
  if (at == null) {
    return '';
  }
  const d = new Date(at);
  const sameDay = new Date(now).toDateString() === d.toDateString();
  if (sameDay) {
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  }
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${months[d.getMonth()]} ${d.getDate()}`;
}

/**
 * Wrap a long base58 address into fixed character groups for display. base58 contains no spaces, so
 * an unbroken string cannot wrap in React Native; inserting actual spaces or soft hyphens would put
 * invisible characters into copied text. This returns the chunks as separate strings and the screen
 * renders them as separate lines: what you see is what the address is, and copy uses the original.
 */
export function addressChunks(address: string, perLine = 12): string[] {
  const chunks: string[] = [];
  for (let i = 0; i < address.length; i += perLine) {
    chunks.push(address.slice(i, i + perLine));
  }
  return chunks;
}
