# Lord of the Rings — Pothos example

A GraphQL schema modeling Middle-earth: characters, races, locations, items, factions, books, chapters, quotes, and battles, plus a thin user-overlay layer (favorites, reading lists, annotations).

This example uses **core Pothos only** — no plugins. It's the foundation that plugin docs (relay, dataloader, scope-auth, prisma, federation, …) build on by layering features onto the same domain.

## What it demonstrates

- Object types and resolvers
- Interfaces (`Character`, `Location`, `Item`) with concrete variants per race / location kind / item kind
- Unions (`SearchResult = Character | Location | Item | Quote`)
- Many-to-many relationships (characters ↔ factions, characters ↔ battles)
- Mutations against a small user-overlay layer

## Run it

```bash
pnpm install
pnpm start
# open http://localhost:3000/graphql
```

## Try a query

```graphql
{
  character(name: "Aragorn") {
    name
    race { name }
    ... on Man {
      kingdom
      descent
    }
  }

  search(term: "ring") {
    __typename
    ... on Character { name }
    ... on RingOfPower { name bearers { name } }
  }
}
```
