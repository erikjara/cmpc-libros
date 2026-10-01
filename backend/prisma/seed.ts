import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import * as argon2 from 'argon2';
import { toSearchKey } from '../src/common/search/search-key.js';
import { Prisma, PrismaClient } from '../src/generated/prisma/client.js';
import { SEED_BOOKS } from './seed-data.js';
import { parseSeedDemoData, shouldSeedDemoBooks } from './seed-options.js';

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

async function seedDemoBooks(prisma: PrismaClient): Promise<string> {
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

  const { count } = await prisma.book.createMany({
    data: SEED_BOOKS.map((book) => ({
      title: book.title,
      titleSearch: toSearchKey(book.title),
      authorSearch: toSearchKey(book.author),
      authorId: authors.get(book.author)!,
      publisherId: publishers.get(book.publisher)!,
      genreId: genres.get(book.genre)!,
      price: new Prisma.Decimal(book.price),
      stock: book.stock,
    })),
  });
  return (
    `${count} libros de demostración, ${authors.size} autores, ` +
    `${publishers.size} editoriales, ${genres.size} géneros`
  );
}

async function main(): Promise<void> {
  const demoData = parseSeedDemoData(process.env.SEED_DEMO_DATA);
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

    // count() del modelo no filtra eliminados: cuenta todas las filas de books.
    const existingBooks = await prisma.book.count();
    const books = shouldSeedDemoBooks(demoData, existingBooks)
      ? await seedDemoBooks(prisma)
      : demoData
        ? `sin libros de demostración (la tabla books ya tiene ${existingBooks} filas)`
        : 'sin libros de demostración (SEED_DEMO_DATA=false)';

    console.log(`Seed completado: admin ${email}; ${books}.`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
