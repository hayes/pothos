import { db } from '../src/db.ts';
import {
  games,
  players,
  pointPlayers,
  points,
  teamRoles,
  teams,
  userRoles,
  users,
} from './schema.ts';

async function seed() {
  // Clean slate (cascade deletes handle the rest).
  await db.delete(users);
  await db.delete(teams);

  // -------------------------------------------------------------------------
  // Users
  // -------------------------------------------------------------------------
  const userRows = await db
    .insert(users)
    .values([
      { email: 'alice@example.com', name: 'Alice' },
      { email: 'bob@example.com', name: 'Bob' },
      { email: 'carol@example.com', name: 'Carol' },
      { email: 'dave@example.com', name: 'Dave' },
    ])
    .returning({ id: users.id, name: users.name });

  const [alice, bob, carol, dave] = userRows;

  await db.insert(userRoles).values([{ userId: alice.id, role: 'admin' }]);

  // -------------------------------------------------------------------------
  // Teams
  // -------------------------------------------------------------------------
  const teamRows = await db
    .insert(teams)
    .values([{ name: 'Hayfield Heroes' }, { name: 'Brookside Bandits' }])
    .returning({ id: teams.id, name: teams.name });

  const [heroes, bandits] = teamRows;

  await db.insert(teamRoles).values([
    { userId: bob.id, teamId: heroes.id, role: 'captain' },
    { userId: carol.id, teamId: heroes.id, role: 'player' },
    { userId: dave.id, teamId: bandits.id, role: 'captain' },
  ]);

  // -------------------------------------------------------------------------
  // Players (roster)
  // -------------------------------------------------------------------------
  const heroesRoster = await db
    .insert(players)
    .values([
      { teamId: heroes.id, name: 'Bob "Handler" Hayes', jerseyNumber: 7 },
      { teamId: heroes.id, name: 'Carol Cutter', jerseyNumber: 12 },
      { teamId: heroes.id, name: 'Maya Sky', jerseyNumber: 21 },
      { teamId: heroes.id, name: 'Jordan Layout', jerseyNumber: 33 },
      { teamId: heroes.id, name: 'Sasha Rivers', jerseyNumber: 44 },
    ])
    .returning({ id: players.id });

  const banditsRoster = await db
    .insert(players)
    .values([
      { teamId: bandits.id, name: 'Dave "Deep" Decker', jerseyNumber: 1 },
      { teamId: bandits.id, name: 'Priya Patel', jerseyNumber: 8 },
      { teamId: bandits.id, name: 'Marcus Reed', jerseyNumber: 15 },
      { teamId: bandits.id, name: 'Lina Park', jerseyNumber: 22 },
      { teamId: bandits.id, name: 'Quinn Marsh', jerseyNumber: 30 },
    ])
    .returning({ id: players.id });

  // -------------------------------------------------------------------------
  // Games
  // -------------------------------------------------------------------------
  const gameRows = await db
    .insert(games)
    .values([
      { homeTeamId: heroes.id, awayTeamId: bandits.id, complete: true },
      { homeTeamId: bandits.id, awayTeamId: heroes.id, complete: false },
    ])
    .returning({ id: games.id });

  const [finishedGame, liveGame] = gameRows;

  // -------------------------------------------------------------------------
  // Points (a handful for the finished game; Heroes won 3-2)
  // -------------------------------------------------------------------------
  const pointRows = await db
    .insert(points)
    .values([
      // Heroes scored to open
      { gameId: finishedGame.id, scoringTeamId: heroes.id, startedOnOffense: true },
      // Bandits broke back
      { gameId: finishedGame.id, scoringTeamId: bandits.id, startedOnOffense: false },
      // Heroes held
      { gameId: finishedGame.id, scoringTeamId: heroes.id, startedOnOffense: true },
      // Bandits held
      { gameId: finishedGame.id, scoringTeamId: bandits.id, startedOnOffense: true },
      // Heroes broke for the win
      { gameId: finishedGame.id, scoringTeamId: heroes.id, startedOnOffense: false },
    ])
    .returning({ id: points.id });

  // Each point: a few players from each team on the field.
  const heroIds = heroesRoster.map((r) => r.id);
  const banditIds = banditsRoster.map((r) => r.id);
  await db
    .insert(pointPlayers)
    .values(
      pointRows.flatMap((p) => [
        ...heroIds.slice(0, 3).map((playerId) => ({ pointId: p.id, playerId })),
        ...banditIds.slice(0, 3).map((playerId) => ({ pointId: p.id, playerId })),
      ]),
    );

  console.log('Seed complete.');
  console.log(`  Users:  ${userRows.map((u) => `${u.id}=${u.name}`).join(', ')}`);
  console.log(`  Teams:  ${teamRows.map((t) => `${t.id}=${t.name}`).join(', ')}`);
  console.log(`  Games:  finished #${finishedGame.id}, live #${liveGame.id}`);
}

seed()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => process.exit(0));
