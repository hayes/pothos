# @pothos/plugin-drizzle

## 0.8.0

### Minor Changes

- 2c0e072: Skip querying field selections within `@defer`red fragments

## 0.7.2

### Patch Changes

- d874bce: Improve inference of multiple interfaces

## 0.7.1

### Patch Changes

- c1db173: Fix error plugin compatability

## 0.7.0

### Minor Changes

- 9cfb6a7: cache input mappings accross resolvers to reduce memory ussage in large schemas

## 0.6.0

### Minor Changes

- 4315edc: Export Object ref type in drizzle plugin

## 0.5.3

### Patch Changes

- 67295e5: Fix drizzle cursors skipping first node after a cursor

## 0.5.2

### Patch Changes

- c71b6bd: fix: drizzle plugin model loader when multiple models are requested

## 0.5.1

### Patch Changes

- 52a70e9: Load client when db request is initialized rather than caching on model loader

## 0.5.0

### Minor Changes

- aadc82c: export client cache so it can be reset during request

## 0.4.7

### Patch Changes

- e98383b: use getMappedArgumentValues to improve relay compatibility

## 0.4.6

### Patch Changes

- 0aadded: improve handling of null cursor values

## 0.4.5

### Patch Changes

- bc73a7b: Fix table types for queries on relations to aliased tables

## 0.4.4

### Patch Changes

- 6dbe790: fix drizzleField list types

## 0.4.3

### Patch Changes

- fa2429f: Fix drizzleFieldWithInput

## 0.4.2

### Patch Changes

- cc5f993: Fix cursors using aliased coluns

## 0.4.1

### Patch Changes

- a6d105b: fix aliased table relations

## 0.4.0

### Minor Changes

- e6a3fb8: Fix query being required, and improve node IDs

## 0.3.0

### Minor Changes

- fc44ea7: Strip path prefixes in built code

## 0.2.1

### Patch Changes

- 0a94d29: Handle parsing of table config in config utils

## 0.2.0

### Minor Changes

- 566ca22: Add option to initialize drizzle client with context

## 0.1.0

### Minor Changes

- 27af377: replace eslint and prettier with biome

## 0.0.1

### Patch Changes

- dd2e758: Initial preview release
