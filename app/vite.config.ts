import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  root: __dirname,
  plugins: [react()],
  server: {
    proxy: {
      '/indexImages': 'http://localhost:3000',
      '/getImages': 'http://localhost:3000',
      '/search': 'http://localhost:3000',
      '/uploadImages': 'http://localhost:3000',
      '/deleteImage': 'http://localhost:3000',
      '/data': 'http://localhost:3000',
      '/debugIndex': 'http://localhost:3000',
    },
  },
});
