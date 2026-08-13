import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import monkey from 'vite-plugin-monkey';

export default defineConfig({
  plugins: [
    monkey({
      entry: 'src/main.ts',
      userscript: {
        author: 'xndeye',
        description: '面向 115 网盘 Web 端的轻量用户脚本，专注下载、离线任务与界面体验',
        icon: 'https://115.com/favicon.ico',
        match: ['https://115.com/*'],
        name: '115 Minus',
        namespace: 'https://github.com/xndeye/115-minus',
        'run-at': 'document-start',
        source: 'https://github.com/xndeye/115-minus',
        connect: ['*'],
        supportURL: 'https://github.com/xndeye/115-minus/issues',
      },
    }),
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
});
