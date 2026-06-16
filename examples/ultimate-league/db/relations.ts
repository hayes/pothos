import { defineRelations } from 'drizzle-orm';
import * as schema from './schema.ts';

export const relations = defineRelations(schema, (r) => ({
  users: {
    userRoles: r.many.userRoles({
      from: r.users.id,
      to: r.userRoles.userId,
    }),
    teamRoles: r.many.teamRoles({
      from: r.users.id,
      to: r.teamRoles.userId,
    }),
    teams: r.many.teams({
      from: r.users.id.through(r.teamRoles.userId),
      to: r.teams.id.through(r.teamRoles.teamId),
    }),
  },
  userRoles: {
    user: r.one.users({
      from: r.userRoles.userId,
      to: r.users.id,
    }),
  },
  teams: {
    teamRoles: r.many.teamRoles({
      from: r.teams.id,
      to: r.teamRoles.teamId,
    }),
    members: r.many.users({
      from: r.teams.id.through(r.teamRoles.teamId),
      to: r.users.id.through(r.teamRoles.userId),
    }),
    roster: r.many.players({
      from: r.teams.id,
      to: r.players.teamId,
    }),
    homeGames: r.many.games({
      from: r.teams.id,
      to: r.games.homeTeamId,
      alias: 'homeGames',
    }),
    awayGames: r.many.games({
      from: r.teams.id,
      to: r.games.awayTeamId,
      alias: 'awayGames',
    }),
    scoredPoints: r.many.points({
      from: r.teams.id,
      to: r.points.scoringTeamId,
    }),
  },
  teamRoles: {
    user: r.one.users({
      from: r.teamRoles.userId,
      to: r.users.id,
    }),
    team: r.one.teams({
      from: r.teamRoles.teamId,
      to: r.teams.id,
    }),
  },
  players: {
    team: r.one.teams({
      from: r.players.teamId,
      to: r.teams.id,
    }),
    pointPlayers: r.many.pointPlayers({
      from: r.players.id,
      to: r.pointPlayers.playerId,
    }),
    points: r.many.points({
      from: r.players.id.through(r.pointPlayers.playerId),
      to: r.points.id.through(r.pointPlayers.pointId),
    }),
  },
  games: {
    homeTeam: r.one.teams({
      from: r.games.homeTeamId,
      to: r.teams.id,
      alias: 'homeGames',
    }),
    awayTeam: r.one.teams({
      from: r.games.awayTeamId,
      to: r.teams.id,
      alias: 'awayGames',
    }),
    points: r.many.points({
      from: r.games.id,
      to: r.points.gameId,
    }),
  },
  points: {
    game: r.one.games({
      from: r.points.gameId,
      to: r.games.id,
    }),
    scoringTeam: r.one.teams({
      from: r.points.scoringTeamId,
      to: r.teams.id,
    }),
    pointPlayers: r.many.pointPlayers({
      from: r.points.id,
      to: r.pointPlayers.pointId,
    }),
    players: r.many.players({
      from: r.points.id.through(r.pointPlayers.pointId),
      to: r.players.id.through(r.pointPlayers.playerId),
    }),
  },
  pointPlayers: {
    point: r.one.points({
      from: r.pointPlayers.pointId,
      to: r.points.id,
    }),
    player: r.one.players({
      from: r.pointPlayers.playerId,
      to: r.players.id,
    }),
  },
}));
