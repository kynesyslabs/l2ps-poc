import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { nodePolyfills } from 'vite-plugin-node-polyfills'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    nodePolyfills({
      // constants/fs/os/vm/readline are pulled in transitively by the ZK libs
      // (fastfile, @cryptkeeperzk/*) which are never executed here — proofs are
      // simulated. Without a polyfill Vite externalizes `constants` with no named
      // exports, so fastfile's `import { O_TRUNC } from 'constants'` breaks the
      // prod bundle. Polyfilling maps constants->constants-browserify and stubs
      // the rest, so the module graph resolves even though the code never runs.
      include: [
        'buffer', 'crypto', 'stream', 'util', 'process', 'events', 'path',
        'constants', 'fs', 'os', 'vm', 'readline',
      ],
      globals: {
        Buffer: true,
        global: true,
        process: true,
      },
    }),
  ],
  optimizeDeps: {
    exclude: ['snarkjs'],
  },
  server: {
    proxy: {
      '/rpc': {
        target: 'http://127.0.0.1:53550',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/rpc/, ''),
        ws: true,
      },
      '/zk': {
        target: 'http://127.0.0.1:53550',
        changeOrigin: true,
      },
    },
  },
})
