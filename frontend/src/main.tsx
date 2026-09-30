import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'

// Punto de entrada provisorio: la tarea 5 lo reemplaza por el router de la aplicación.
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <main className="p-6 text-lg font-semibold">CMPC-libros</main>
  </StrictMode>,
)
