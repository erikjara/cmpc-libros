import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Controller, useForm } from 'react-hook-form'
import { useNavigate, useSearchParams } from 'react-router'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Field, FieldError, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { getErrorMessage } from '@/lib/api-error'
import { login } from './auth.api'
import { loginSchema, type LoginFormValues } from './login.schema'
import { safeRedirectTarget } from './require-auth'
import { sessionQueryKey } from './session'

export function LoginPage() {
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const form = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    mode: 'onChange',
    defaultValues: { email: '', password: '' },
  })
  const mutation = useMutation({
    mutationFn: login,
    onSuccess: async (user) => {
      queryClient.setQueryData(sessionQueryKey, user)
      await navigate(safeRedirectTarget(searchParams.get('redirectTo')), { replace: true })
    },
  })

  const onSubmit = form.handleSubmit((values) => mutation.mutateAsync(values).catch(() => undefined))

  return (
    <main className="flex min-h-svh items-center justify-center bg-muted/40 p-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>CMPC-libros</CardTitle>
          <CardDescription>Ingresa con tu cuenta para gestionar el inventario.</CardDescription>
        </CardHeader>
        <CardContent>
          <form noValidate onSubmit={onSubmit}>
            <FieldGroup>
              <Controller
                name="email"
                control={form.control}
                render={({ field, fieldState }) => (
                  <Field data-invalid={fieldState.invalid}>
                    <FieldLabel htmlFor="login-email">Correo</FieldLabel>
                    <Input
                      {...field}
                      id="login-email"
                      type="email"
                      autoComplete="email"
                      aria-invalid={fieldState.invalid}
                    />
                    {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
                  </Field>
                )}
              />
              <Controller
                name="password"
                control={form.control}
                render={({ field, fieldState }) => (
                  <Field data-invalid={fieldState.invalid}>
                    <FieldLabel htmlFor="login-password">Contraseña</FieldLabel>
                    <Input
                      {...field}
                      id="login-password"
                      type="password"
                      autoComplete="current-password"
                      aria-invalid={fieldState.invalid}
                    />
                    {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
                  </Field>
                )}
              />
              {mutation.isError && (
                <p role="alert" className="text-sm text-destructive">
                  {getErrorMessage(mutation.error)}
                </p>
              )}
              <Button
                type="submit"
                disabled={!form.formState.isValid || form.formState.isSubmitting}
              >
                {form.formState.isSubmitting ? 'Ingresando…' : 'Ingresar'}
              </Button>
            </FieldGroup>
          </form>
        </CardContent>
      </Card>
    </main>
  )
}
