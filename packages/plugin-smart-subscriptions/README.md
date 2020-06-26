# Smart Subscriptions Plugin for GiraphQL

This plugin provides a way of turning queries into graphql subscriptions. Each field, Object, and
Interface in a schema can define subscriptions to be registerd when that field or type is used in a
smart subscription.

The basic flow of a smart subscription is:

1. Run the query the smart subscription is based on and push the initial result of that query to the
   subsciption
1. As the query is resolved, register any subscriptions defined on fields or types that where used
   in the query
1. When any of the subscriptions are triggered, re-execute the query and push the updated data to
   the subsciption.

There are additional options which will allow only the sub-tree of a field/type that triggered a
fetch to re-resolved.

This pattern makes it easy to define subscriptions without having to worry about what parts of your
schema are accessible via the subscribe query, since any type or field can register a subscrption.

## Full docs available at https://giraphql.com/plugins-smart-subscriptions
