import { createHmac, createHash, timingSafeEqual, randomBytes } from 'node:crypto';
import { validState, mergeStates, sameEntries, emptyState } from '../public/state.js';
const cookieName = 'fieldnotes_session';
const json = (data, status = 200, headers = {}) => new Response(JSON.stringify(data), { status, headers:{'Content-Type':'application/json','Cache-Control':'no-store',...headers} });
function sameSecret(a,b) { return timingSafeEqual(createHash('sha256').update(a).digest(),createHash('sha256').update(b).digest()); }
function sign(payload,code) { return createHmac('sha256',code).update(payload).digest('base64url'); }
function token(code,now) { const payload = Buffer.from(JSON.stringify({ exp:now + 12*60*60*1000, nonce:randomBytes(12).toString('hex') })).toString('base64url'); return `${payload}.${sign(payload,code)}`; }
function authenticated(request,code,now) {
  const cookies = request.headers.get('cookie') || '';
  const raw = cookies.split(';').map(s=>s.trim()).find(s=>s.startsWith(cookieName+'='))?.slice(cookieName.length+1);
  if (!raw || raw.length > 500) return false;
  const [payload,sig] = raw.split('.');
  try { return sig && sameSecret(sig,sign(payload,code)) && JSON.parse(Buffer.from(payload,'base64url').toString()).exp > now; } catch { return false; }
}
function correctOrigin(request) {
  const origin = request.headers.get('origin');
  return !origin || origin === new URL(request.url).origin;
}
async function body(request) {
  if (Number(request.headers.get('content-length') || 0) > 500000) throw new Error('Request is too large.');
  const text = await request.text();
  if (Buffer.byteLength(text) > 500000) throw new Error('Request is too large.');
  return JSON.parse(text);
}
export function createSessionHandler({ getCode = () => process.env.DASHBOARD_ACCESS_CODE, now = Date.now } = {}) {
  return async request => {
    if (!correctOrigin(request)) return json({error:'Request origin is not allowed.'},403);
    if (request.method === 'DELETE') return json({ok:true},200,{'Set-Cookie':`${cookieName}=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0`});
    if (request.method !== 'POST') return json({error:'Method not allowed.'},405,{'Allow':'POST, DELETE'});
    const code = getCode();
    if (!code || code.length < 16) return json({error:'Shared space needs a DASHBOARD_ACCESS_CODE of at least 16 characters in Netlify. Local saving remains available.'},503);
    try {
      const input = await body(request);
      if (typeof input.code !== 'string' || input.code.length > 1000 || !sameSecret(input.code,code)) return json({error:'That access code is not correct.'},401);
      return json({ok:true},200,{'Set-Cookie':`${cookieName}=${token(code,now())}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=43200`});
    } catch { return json({error:'Invalid sign-in request.'},400); }
  };
}
export function createProgressHandler({ getStore, getCode = () => process.env.DASHBOARD_ACCESS_CODE, now = Date.now }) {
  return async request => {
    if (!['GET','PUT'].includes(request.method)) return json({error:'Method not allowed.'},405,{'Allow':'GET, PUT'});
    if (!correctOrigin(request)) return json({error:'Request origin is not allowed.'},403);
    const code = getCode();
    if (!code || code.length < 16) return json({error:'Shared space has not been configured. Your work is saved on this device.'},503);
    if (!authenticated(request,code,now())) return json({error:'Connect to your shared space to continue.'},401);
    try {
      const store = getStore();
      if (request.method === 'GET') return json({state:(await store.get('household-progress',{type:'json',consistency:'strong'})) || emptyState()});
      const incoming = await body(request);
      if (!validState(incoming) || Object.values(incoming.entries).some(e=>e.updatedAt>now()+5*60*1000)) return json({error:'The progress data is invalid. Check your device clock.'},400);
      // Conditional writes prevent one device from overwriting changes from another.
      for (let attempt=0;attempt<5;attempt++) {
        const current = await store.getWithMetadata('household-progress',{type:'json',consistency:'strong'});
        const merged = mergeStates(current?.data || emptyState(),incoming);
        if(current && sameEntries(current.data,merged)) return json({state:merged,savedAt:now()});
        if (Object.keys(merged.entries).length > 3000 || Buffer.byteLength(JSON.stringify(merged)) > 500000) return json({error:'The shared space is full. Export a backup before removing older entries.'},413);
        const result = await store.setJSON('household-progress',merged,current ? {onlyIfMatch:current.etag} : {onlyIfNew:true});
        if (result.modified) return json({state:merged,savedAt:now()});
      }
      return json({error:'Someone else is saving right now. Try syncing again.'},409);
    } catch { return json({error:'Shared saving is unavailable. Your local copy is safe. Try again shortly.'},503); }
  };
}
