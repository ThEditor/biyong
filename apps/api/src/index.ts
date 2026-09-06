import { serve } from '@hono/node-server';
import { createApp } from './app.js';

const app = createApp();
const port = Number(process.env.PORT || 4000);

console.log(`Starting Biyong API server on port ${port}...`);

serve({
  fetch: app.fetch,
  port,
});

export { app };
