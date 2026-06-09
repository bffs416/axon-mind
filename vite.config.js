import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    proxy: {
      '/rest/v1': {
        target: 'http://192.168.2.16:8087',
        changeOrigin: true,
        secure: false,
        rewrite: (path) => path.replace(/^\/rest\/v1/, ''),
      },
      '/webhook': {
        target: 'http://192.168.2.16:5678',
        changeOrigin: true,
        secure: false,
      }
    }
  }
});
