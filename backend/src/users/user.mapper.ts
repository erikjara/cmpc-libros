import type { User } from '../generated/prisma/client.js';

export interface UserDto {
  id: string;
  email: string;
  name: string;
}

export function toUserDto(user: Pick<User, 'id' | 'email' | 'name'>): UserDto {
  return { id: user.id, email: user.email, name: user.name };
}
