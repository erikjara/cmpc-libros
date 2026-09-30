import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import * as argon2 from 'argon2';
import { Prisma, PrismaClient } from '../src/generated/prisma/client.js';
import { SEED_BOOKS } from './seed-data.js';

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Falta la variable de entorno ${name}`);
  }
  return value;
}

async function upsertByName(
  prisma: PrismaClient,
  model: 'author' | 'publisher' | 'genre',
  names: string[],
): Promise<Map<string, string>> {
  const ids = new Map<string, string>();
  for (const name of new Set(names)) {
    const args = {
      where: { name },
      create: { name },
      update: {},
      select: { id: true },
    };
    const { id } =
      model === 'author'
        ? await prisma.author.upsert(args)
        : model === 'publisher'
          ? await prisma.publisher.upsert(args)
          : await prisma.genre.upsert(args);
    ids.set(name, id);
  }
  return ids;
}

async function main(): Promise<void> {
  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: requireEnv('DATABASE_URL') }),
  });

  try {
    const email = requireEnv('SEED_ADMIN_EMAIL').trim().toLowerCase();
    const password = requireEnv('SEED_ADMIN_PASSWORD');
    // update vacío: el seed no pisa una contraseña cambiada después.
    await prisma.user.upsert({
      where: { email },
      create: {
        email,
        name: 'Administrador',
        passwordHash: await argon2.hash(password, { type: argon2.argon2id }),
      },
      update: {},
    });

    const authors = await upsertByName(
      prisma,
      'author',
      SEED_BOOKS.map((b) => b.author),
    );
    const publishers = await upsertByName(
      prisma,
      'publisher',
      SEED_BOOKS.map((b) => b.publisher),
    );
    const genres = await upsertByName(
      prisma,
      'genre',
      SEED_BOOKS.map((b) => b.genre),
    );

    let created = 0;
    for (const book of SEED_BOOKS) {
      const authorId = authors.get(book.author)!;
      const exists = await prisma.book.findFirst({
        where: { title: book.title, authorId },
        select: { id: true },
      });
      if (exists) {
        continue;
      }
      await prisma.book.create({
        data: {
          title: book.title,
          authorId,
          publisherId: publishers.get(book.publisher)!,
          genreId: genres.get(book.genre)!,
          price: new Prisma.Decimal(book.price),
          stock: book.stock,
        },
      });
      created += 1;
    }

    console.log(
      `Seed completado: admin ${email}, ${authors.size} autores, ${publishers.size} editoriales, ` +
        `${genres.size} géneros, ${created} libros nuevos (${SEED_BOOKS.length} en el catálogo semilla).`,
    );
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
