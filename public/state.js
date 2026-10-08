export const STORAGE_KEY = 'fieldnotes.learning.v1';
export const emptyState = () => ({ schemaVersion:1, entries:{} });
export function validState(state) {
  if (!state || state.schemaVersion !== 1 || typeof state.entries !== 'object' || !state.entries || Array.isArray(state.entries)) return false;
  const entries = Object.entries(state.entries);
  if (entries.length > 3000) return false;
  return entries.every(([key, entry]) => /^[a-zA-Z0-9:_-]{1,160}$/.test(key) && !['__proto__','constructor','prototype'].includes(key) && entry && typeof entry === 'object' && Number.isSafeInteger(entry.updatedAt) && entry.updatedAt > 0 && Object.hasOwn(entry,'value') && JSON.stringify(entry.value)?.length <= 15000);
}
export function mergeStates(a, b) {
  const result = emptyState();
  for (const state of [a,b]) {
    for (const [key, entry] of Object.entries(state?.entries || {})) {
      const current = result.entries[key];
      if (!current || entry.updatedAt > current.updatedAt || (entry.updatedAt === current.updatedAt && JSON.stringify(entry.value) > JSON.stringify(current.value))) result.entries[key] = structuredClone(entry);
    }
  }
  return result;
}
export function sameEntries(a,b) {
  const aa=a?.entries || {},bb=b?.entries || {};
  return Object.keys(aa).length===Object.keys(bb).length && Object.entries(aa).every(([key,entry])=>JSON.stringify(entry)===JSON.stringify(bb[key]));
}
export function getValue(state, key, fallback = '') { return state.entries[key]?.value ?? fallback; }
export function writeValue(state, key, value, now = Date.now()) {
  const stamp = Math.max(now, (state.entries[key]?.updatedAt || 0) + 1);
  state.entries[key] = { value, updatedAt:stamp };
  return state;
}
export function monthProgress(state, id) {
  const weeks = Array.from({length:4}, (_, i) => !!getValue(state,`${id}:week:${i}`,false));
  const resource = !!getValue(state,`${id}:resource`,false);
  const result = !!getValue(state,`${id}:result`,false);
  const review = reviewComplete(state,id);
  const count = weeks.filter(Boolean).length + Number(resource) + Number(result) + Number(review);
  return { weeks, resource, result, review, count, total:7, percent:Math.round(count / 7 * 100), complete:count === 7 };
}
export function reviewComplete(state,id) {
  return !!getValue(state,`${id}:review:complete`,false) && ['date','understanding','action'].every(field => String(getValue(state,`${id}:review:${field}`)).trim());
}
export function nextMonth(state,months) { return months.find(m => !monthProgress(state,m.id).complete) || months[months.length-1]; }
export function weekKey(date = new Date()) {
  // Nairobi's calendar date, then Monday for that local week.
  const parts = new Intl.DateTimeFormat('en-CA',{timeZone:'Africa/Nairobi',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(date);
  const v = Object.fromEntries(parts.map(p => [p.type,p.value]));
  const d = new Date(`${v.year}-${v.month}-${v.day}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() - (d.getUTCDay()+6)%7);
  return d.toISOString().slice(0,10);
}
export function listEntries(state,prefix) { return Object.entries(state.entries).filter(([key,entry]) => key.startsWith(prefix) && entry.value !== null).map(([key,entry]) => ({key,...entry.value})); }
export function safeUrl(value) {
  try { const u = new URL(value); return ['https:','http:'].includes(u.protocol) ? u.href : ''; } catch { return ''; }
}
