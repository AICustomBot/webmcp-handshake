import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

const fromRoot = (relative: string) => fileURLToPath(new URL(relative, import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      '@handshake/contracts': fromRoot('./packages/contracts/src/index.ts'),
      '@handshake/policy': fromRoot('./packages/policy/src/index.ts'),
      'cloudflare:workers': fromRoot('./tests/cloudflare-workers-stub.ts'),
      '@/': fromRoot('./apps/web/'),
      '@': fromRoot('./apps/web'),
    },
  },
  test: {
    include: ['tests/**/*.test.ts'],
  },
});
