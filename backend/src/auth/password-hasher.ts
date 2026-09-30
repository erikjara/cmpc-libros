import { Injectable } from '@nestjs/common';
import * as argon2 from 'argon2';

/** Hash de contraseñas con Argon2id (recomendación OWASP). */
@Injectable()
export class PasswordHasher {
  private dummyHash?: Promise<string>;

  hash(plain: string): Promise<string> {
    return argon2.hash(plain, { type: argon2.argon2id });
  }

  /**
   * Verifica la contraseña. Si el usuario no existe (`hash === null`) igual
   * ejecuta una verificación contra un hash ficticio para no revelar, por
   * tiempo de respuesta, qué emails están registrados.
   */
  async verify(hash: string | null, plain: string): Promise<boolean> {
    const target = hash ?? (await this.getDummyHash());
    try {
      const matches = await argon2.verify(target, plain);
      return hash !== null && matches;
    } catch {
      return false;
    }
  }

  private getDummyHash(): Promise<string> {
    this.dummyHash ??= this.hash('cmpc-dummy-password');
    return this.dummyHash;
  }
}
