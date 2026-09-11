import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3';
import { PrismaClient } from './generated/client/client';

export async function createDatabase() {
  const directory = mkdtempSync(join(tmpdir(), 'pothos-publishing-'));
  const statements: string[] = [];
  const prisma = new PrismaClient({
    adapter: new PrismaBetterSqlite3({ url: `file:${join(directory, 'publishing.db')}` }),
    log: [{ emit: 'event', level: 'query' }],
  });
  prisma.$on('query', (event) => statements.push(event.query));
  const close = async () => {
    await prisma.$disconnect();
    rmSync(directory, { recursive: true, force: true });
  };
  try {
    // This disposable database belongs to this run. Application databases should
    // use Prisma migrations; no existing database is reset by this example.
    const ddl = readFileSync(new URL('./generated/schema.sql', import.meta.url), 'utf8');
    for (const statement of ddl.split(';').filter((sql) => sql.trim())) {
      await prisma.$executeRawUnsafe(statement);
    }
    await prisma.user.createMany({
      data: [
        { id: 1, name: 'Maya Chen', email: 'maya@example.com', isAdmin: true },
        { id: 2, name: 'Leo Silva', email: 'leo@example.com' },
        { id: 3, name: 'Nora Ellis', email: 'nora@example.com' },
      ],
    });
    await prisma.profile.create({ data: { userId: 1, bio: 'Writes about community gardens.' } });
    const createdAt = new Date('2026-01-15T09:00:00.000Z');
    await prisma.post.createMany({
      data: [
        {
          id: 1,
          authorId: 1,
          title: 'Starting a seed library',
          content: 'Share seeds with your neighbors.',
          published: true,
          createdAt,
        },
        {
          id: 2,
          authorId: 1,
          title: 'A guide to composting',
          content: 'Turn kitchen scraps into healthy soil.',
          published: true,
          createdAt,
        },
        {
          id: 3,
          authorId: 2,
          title: 'Watering through summer',
          content: 'Water early and mulch deeply.',
          published: true,
          createdAt,
        },
        {
          id: 5,
          authorId: 2,
          title: 'Saving rainwater',
          content: 'Leo’s unpublished draft.',
          published: false,
          createdAt,
        },
        {
          id: 4,
          authorId: 1,
          title: 'Planning the spring exchange',
          content: 'An unpublished editorial draft.',
          published: false,
          createdAt,
        },
      ],
    });
    await prisma.comment.create({
      data: { authorId: 2, postId: 1, content: 'Our library would love to host this.', createdAt },
    });
    await prisma.media.createMany({
      data: [
        { id: 1, url: 'https://images.example.com/seed-library.jpg', uploadedById: 2 },
        { id: 2, url: 'https://images.example.com/seed-packets.jpg', uploadedById: 1 },
      ],
    });
    await prisma.postMedia.createMany({
      data: [
        { id: 1, postId: 1, mediaId: 1, caption: 'The neighborhood seed library' },
        { id: 2, postId: 2, mediaId: 1, caption: 'Compost helps the seed library grow' },
        { id: 3, postId: 1, mediaId: 2, caption: 'Label packets before sharing' },
      ],
    });
    statements.length = 0;
    return { prisma, statements, close };
  } catch (error) {
    await close();
    throw error;
  }
}
