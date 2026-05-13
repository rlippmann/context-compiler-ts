import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const ROOT = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      '@rlippmann/context-compiler/experimental/preprocessor': resolve(
        ROOT,
        'src/experimental/preprocessor/index.ts'
      )
    }
  },
  test: {
    include: ['tests/**/*.test.ts']
  }
});
