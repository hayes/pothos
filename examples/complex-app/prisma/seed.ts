/* eslint-disable no-await-in-loop */
/* eslint-disable no-magic-numbers */
import { faker } from '@faker-js/faker';
import { Prisma, PrismaClient } from './client';

const prisma = new PrismaClient();

faker.seed(123);

async function main() {
  for (let i = 0; i < 10; i += 1) {
    await createTeam();
  }
}

main().catch((error) => {
  console.error(error);
});

function createTeam() {
  const players: Prisma.PlayerCreateWithoutTeamInput[] = [];

  for (let i = 0; i < 10; i += 1) {
    players.push({
      number: i,
      name: faker.name.firstName(),
    });
  }

  return prisma.team.create({
    data: {
      name: faker.company.name(),
      players: {
        create: players,
      },
    },
  });
}
