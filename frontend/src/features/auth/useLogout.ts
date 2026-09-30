import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router'
import { toast } from 'sonner'
import { getErrorMessage } from '@/lib/api-error'
import { logout } from './auth.api'
import { sessionQueryKey } from './session'

export function useLogout() {
  const queryClient = useQueryClient()
  const navigate = useNavigate()

  return useMutation({
    mutationFn: logout,
    onSuccess: async () => {
      queryClient.removeQueries({ queryKey: sessionQueryKey })
      await navigate('/login', { replace: true })
      queryClient.clear()
    },
    onError: (error) => {
      toast.error(getErrorMessage(error))
    },
  })
}
