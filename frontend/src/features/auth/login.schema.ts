import * as z from 'zod'

export const loginSchema = z.object({
  email: z.string().trim().min(1, 'Ingresa tu correo').pipe(z.email('Ingresa un correo válido')),
  password: z.string().min(1, 'Ingresa tu contraseña').max(128, 'Máximo 128 caracteres'),
})

export type LoginFormValues = z.infer<typeof loginSchema>
