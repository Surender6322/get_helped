// Compact date format used in chat headers and similar surfaces:
//   "17:32, 17 May 2026"
// Accepts a millis number, a JS Date, or a Firestore Timestamp-like object
// with toMillis(); returns null for missing input.

export function formatShortDateTime(ts) {
  const millis =
    typeof ts === 'number'
      ? ts
      : typeof ts?.toMillis === 'function'
        ? ts.toMillis()
        : ts instanceof Date
          ? ts.getTime()
          : null;
  if (millis == null || Number.isNaN(millis)) return null;

  const d = new Date(millis);
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  const day = d.getDate();
  const month = d.toLocaleString('en-US', { month: 'short' });
  const year = d.getFullYear();
  return `${hh}:${mm}, ${day} ${month} ${year}`;
}
