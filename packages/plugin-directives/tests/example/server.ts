import { useRateLimiter } from '@envelop/rate-limiter';
import { createTestServer } from '@pothos/test-utils';
import schema from './schema';

const server = createTestServer({
  schema,
  plugins: [
    useRateLimiter({
      identifyFn: () => {
        return '1';
      },
    }),
  ],
});

server.listen(3000, () => {
  console.log('🚀 Server started at http://127.0.0.1:3000');
});
