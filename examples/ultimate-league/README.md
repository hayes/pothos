# Ultimate frisbee league — Pothos example

A small but realistic league-management schema: users, teams, rosters, two-team games, and point-by-point scoring. Backed by SQLite + Drizzle. Demonstrates mutations, authorization, and input validation in one cohesive domain.

## Plugins demonstrated

| Plugin | What it powers here |
| --- | --- |
| [`plugin-drizzle`](../../packages/plugin-drizzle) | Every type is a `drizzleObject` over the SQLite schema; relations resolve via `t.relation()` / `t.relatedConnection()`. |
| [`plugin-scope-auth`](../../packages/plugin-scope-auth) | Four scopes — `loggedIn`, `admin`, `teamCaptain(teamId)`, `teamMember(teamId)` — gate queries, fields, and mutations. |
| [`plugin-validation`](../../packages/plugin-validation) | Argument validation with zod (jersey numbers 0–99, name length, etc.). |

## Domain

```
users ──< teamRoles >── teams ──< players
                          │  ──< games (homeTeam, awayTeam)
                          │        │
                          └────────┴──< points (scoringTeam) ──< pointPlayers >── players
users ──< userRoles (global, currently just 'admin')
```

- **Game** is between a `homeTeam` and `awayTeam` (both in our DB).
- **Point** records who scored, who started on offense, and which players were on the field.
- **TeamRole** = `'captain' | 'player'` per (user, team) edge.
- **UserRole** = global role, currently only `'admin'`.

## Run it

```bash
pnpm install
pnpm run db:reset   # migrate + seed
pnpm start          # http://localhost:3000/graphql
```

## Authenticating as different users

The yoga server reads `x-user-id` from request headers and resolves it to the seeded user. Try:

```bash
# As Alice (admin):    x-user-id: 1
# As Bob (Heroes captain):    x-user-id: 2
# As Carol (Heroes player):   x-user-id: 3
# As Dave (Bandits captain):  x-user-id: 4
# Unauthenticated:     omit the header

curl -X POST http://localhost:3000/graphql \
  -H 'content-type: application/json' \
  -H 'x-user-id: 2' \
  --data '{"query":"mutation { createGame(homeTeamId:\"1\", awayTeamId:\"2\") { id homeTeam { name } awayTeam { name } } }"}'
```

## Try

```graphql
query {
  team(id: "1") {
    name
    roster { name jerseyNumber }
    homeGames {
      homeTeam { name }
      awayTeam { name }
      complete
      homeScore
      awayScore
    }
  }
}
```
