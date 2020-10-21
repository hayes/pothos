# Auth Plugin for GiraphQL

This plugin provides a way to handle authorization/permissions checks throughout your schema.

Because GraphQL schemas are graphs and fields can be aliased in responses, knowing what data is
accessed at the root a query can be very difficult. Using a traditioal pattern of performing checks
at the start of a request, or by inrospecting the result of a request does not work well, since data
may be queried through a complex set of relations, and the resulting response can have fields
aliased to any other name.

The GirahQL auth plugin tries to solve a number of common authorization patterns/problems:

- Simple checks on any field in a schem (At the Query/Mutation level, or nested deep inside a
  schema)
- Checks that run before resolving any field of a specific type
- Checks that run after resolving any field of a specific type
- Defining reusable permissions that are used by multiple field on the same object
- Granting permissions from a parent field to the objects/types it returns

## Full docs available at https://giraphql.com/plugins/auth
