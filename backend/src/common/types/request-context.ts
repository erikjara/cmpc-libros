/** Usuario autenticado que `JwtStrategy.validate` deja en `req.user`. */
export interface AuthUser {
  id: string;
  email: string;
}

/** Datos de la request que se pasan explícitamente a los services (auditoría). */
export interface RequestContext {
  userId: string | null;
  ip: string | null;
  userAgent: string | null;
}
