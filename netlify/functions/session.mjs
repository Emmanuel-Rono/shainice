import { createSessionHandler } from '../../server/api.mjs';
export default createSessionHandler();
export const config = {
  path:'/api/session',
  rateLimit:{windowLimit:10,windowSize:60,aggregateBy:'ip'}
};
