/** Enmascara un email para logs: `admin@cmpc.cl` → `a***@cmpc.cl`; sin `@` → `***`. */
export function maskEmail(email: string): string {
  const at = email.indexOf('@');
  if (at === -1) {
    return '***';
  }
  return `${email.slice(0, Math.min(at, 1))}***${email.slice(at)}`;
}
