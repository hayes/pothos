## Install dependencies and build packages

```bash
pnpm install
pnpm build
```

## Run tests

```bash
pnpm test
```

You can also run tests for specific packages:

```bash
pnpm --filter @pothos/core exec vitest
```

## Regenerating any generated types for examples and tests

```bash
pnpm run -r generate
```

## Running examples

```bash
cd examples/path-to-example-app
pnpm start
# or
pnpm dev # If the example supports a dev/watch mode
```

## Adding new plugins or examples

New plugins and examples are more than welcome!

It's generally best to open an issue before adding new features and plugins to avoid any duplicated
effort, and ensure any new plugins make sense to add to this repo.

The easiest way to create add an example or plugin is to copy one of the existing packages. This
will help get something set up quickly that works with all the existing scripts. Once you have a
copy of an existing package building correctly, you can modify the example to implement the correct
behavior.

## Docs

Documentation lives in the `/docs` directory, but the contents of the plugin docs are duplicated in
the README.md of each plugin so that each package has a useful readme when published to npm. If you
are editing documentation for a plugin, keeping those changes in sync with the packages README files
is usually required. This is a temporary workaround until a better solution can be found.
