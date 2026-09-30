import { httpClient } from '@/lib/http-client'
import type { ApiResponse, LoginInput, User } from '@/lib/api-types'

export async function login(input: LoginInput): Promise<User> {
  const response = await httpClient.post<ApiResponse<{ user: User }>>('/auth/login', input)
  return response.data.data.user
}

export async function logout(): Promise<void> {
  await httpClient.post('/auth/logout')
}

export async function fetchMe(): Promise<User> {
  const response = await httpClient.get<ApiResponse<User>>('/auth/me')
  return response.data.data
}
