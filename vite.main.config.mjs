import { defineConfig } from 'vite';

export default defineConfig({
  resolve: {
    conditions: ['node'],
    mainFields: ['module', 'jsnext:main', 'jsnext'],
  },
  build: {
    rollupOptions: {
      external: ['electron'],
    },
  },
  ssr: {
    noExternal: [
      '@langchain/langgraph',
      '@langchain/core',
      '@langchain/openai',
      '@langchain/ollama',
      '@langchain/textsplitters',
      'zod',
    ],
  },
});
