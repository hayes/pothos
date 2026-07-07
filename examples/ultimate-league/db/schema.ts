import { sql } from 'drizzle-orm';
import { index, integer, primaryKey, sqliteTable, text, unique } from 'drizzle-orm/sqlite-core';

// ---------------------------------------------------------------------------
// Users + global roles
// ---------------------------------------------------------------------------

export const users = sqliteTable('users', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  email: text('email').notNull().unique(),
  name: text('name').notNull(),
  createdAt: text('created_at').notNull().default(sql`(current_timestamp)`),
});

/**
 * Site-wide role grants. Currently only 'admin' is meaningful, but the table
 * is shaped for future expansion.
 */
export const userRoles = sqliteTable(
  'user_roles',
  {
    userId: integer('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    role: text('role', { enum: ['admin'] }).notNull(),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.userId, t.role] }),
  }),
);

// ---------------------------------------------------------------------------
// Teams + per-team roles
// ---------------------------------------------------------------------------

export const teams = sqliteTable('teams', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull().unique(),
  createdAt: text('created_at').notNull().default(sql`(current_timestamp)`),
});

/**
 * Per-team membership. A user can be a 'captain' or 'player' on any number of
 * teams (but only one role per (user, team) pair).
 */
export const teamRoles = sqliteTable(
  'team_roles',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    userId: integer('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    teamId: integer('team_id')
      .notNull()
      .references(() => teams.id, { onDelete: 'cascade' }),
    role: text('role', { enum: ['captain', 'player'] }).notNull(),
  },
  (t) => ({
    uniqueUserTeam: unique('team_roles_user_team_uniq').on(t.userId, t.teamId),
    userIdx: index('team_roles_user_idx').on(t.userId),
    teamIdx: index('team_roles_team_idx').on(t.teamId),
  }),
);

// ---------------------------------------------------------------------------
// Players (roster entries)
// ---------------------------------------------------------------------------

/**
 * A player is a roster entry on a team. Independent from `users` — not every
 * player needs a login. (A future iteration can link `players.userId` to a
 * user account.)
 */
export const players = sqliteTable(
  'players',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    teamId: integer('team_id')
      .notNull()
      .references(() => teams.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    jerseyNumber: integer('jersey_number').notNull(),
  },
  (t) => ({
    uniqueTeamJersey: unique('players_team_jersey_uniq').on(t.teamId, t.jerseyNumber),
    teamIdx: index('players_team_idx').on(t.teamId),
  }),
);

// ---------------------------------------------------------------------------
// Games (between two teams in our DB)
// ---------------------------------------------------------------------------

export const games = sqliteTable(
  'games',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    homeTeamId: integer('home_team_id')
      .notNull()
      .references(() => teams.id),
    awayTeamId: integer('away_team_id')
      .notNull()
      .references(() => teams.id),
    complete: integer('complete', { mode: 'boolean' }).notNull().default(false),
    createdAt: text('created_at').notNull().default(sql`(current_timestamp)`),
  },
  (t) => ({
    homeIdx: index('games_home_idx').on(t.homeTeamId),
    awayIdx: index('games_away_idx').on(t.awayTeamId),
  }),
);

// ---------------------------------------------------------------------------
// Points (the scoring unit) + which players were on the field
// ---------------------------------------------------------------------------

export const points = sqliteTable(
  'points',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    gameId: integer('game_id')
      .notNull()
      .references(() => games.id, { onDelete: 'cascade' }),
    scoringTeamId: integer('scoring_team_id')
      .notNull()
      .references(() => teams.id),
    /** From the scoring team's perspective: did they start on offense (a "hold")? */
    startedOnOffense: integer('started_on_offense', { mode: 'boolean' }).notNull(),
    createdAt: text('created_at').notNull().default(sql`(current_timestamp)`),
  },
  (t) => ({
    gameIdx: index('points_game_idx').on(t.gameId),
  }),
);

/** Many-to-many: which players (from either team) were on the field for this point. */
export const pointPlayers = sqliteTable(
  'point_players',
  {
    pointId: integer('point_id')
      .notNull()
      .references(() => points.id, { onDelete: 'cascade' }),
    playerId: integer('player_id')
      .notNull()
      .references(() => players.id, { onDelete: 'cascade' }),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.pointId, t.playerId] }),
    playerIdx: index('point_players_player_idx').on(t.playerId),
  }),
);
