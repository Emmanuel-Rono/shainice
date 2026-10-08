import { getStore } from '@netlify/blobs';
import { createProgressHandler } from '../../server/api.mjs';
export default createProgressHandler({getStore:()=>getStore({name:'fieldnotes-learning',consistency:'strong'})});
export const config = { path:'/api/progress' };
