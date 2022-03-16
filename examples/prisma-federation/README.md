# THIS IS STILL A WORK IN PROGRESS AND NOT FULLY FUNCTIONAL

# A relay compatible GraphQL API using Apollo federation with prisma

This example uses the following packages:

- `@pothos/core`: For building the schema
- `@pothos/plugin-federation`: For creating federation compatible schemas
- `@pothos/plugin-prisma`: For prisma based type definitions, and efficient queries
- `@pothos/plugin-relay`: For adding relay compatible connections and nodes
- `@prisma/client`: For querying data from a database
- `prisma`: For running migrations and generating `@prisma/client`
- `apollo-server`: For creating a server that executes the schema
