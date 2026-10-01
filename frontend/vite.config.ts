import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: { tsconfigPaths: true },
  build: {
    rolldownOptions: {
      output: {
        // Dependencias de la carga inicial en chunks con nombre estable (se cachean entre
        // despliegues). Sin grupo comodín: las librerías que solo usan páginas diferidas
        // (formularios) deben seguir viajando con esas páginas.
        codeSplitting: {
          groups: [
            { name: 'react', test: /node_modules[\\/](react|react-dom|scheduler|react-router)[\\/]/, priority: 30 },
            { name: 'base-ui', test: /node_modules[\\/]@base-ui[\\/]/, priority: 20 },
            { name: 'tanstack', test: /node_modules[\\/]@tanstack[\\/]/, priority: 10 },
          ],
        },
      },
    },
  },
  server: {
    port: 5173,
    proxy: { '/api': { target: 'http://localhost:3000', changeOrigin: true } },
  },
})
