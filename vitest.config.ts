import { defineConfig } from 'vitest/config';
import { mergeConfig } from 'vite';
import viteConfig from './vite.config';

export default mergeConfig(
  viteConfig,
  defineConfig({
    test: {
      environment: 'node',
      include: ['tests/unit/**/*.test.ts'],
      coverage: {
        provider: 'v8',
        reporter: ['text', 'json', 'html'],
        include: ['src/**/*.{ts,tsx}', 'scripts/**/*.ts'],
        exclude: [
          'node_modules/**',
          'tests/**',
          '**/*.d.ts',
          '**/*.config.ts',
          '**/types.ts',
        ],
      },
    },
  })
);
