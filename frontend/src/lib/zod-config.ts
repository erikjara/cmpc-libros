import * as z from 'zod'

// Sin compilación JIT de validadores: zod no prueba `new Function`, que la CSP (sin
// 'unsafe-eval') bloquea y el navegador reporta como violación. Debe importarse antes que
// cualquier módulo que construya schemas, porque zod decide el modo al crearlos.
z.config({ jitless: true })
