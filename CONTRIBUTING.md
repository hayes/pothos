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

Documentation lives in the `website/content/docs` directory, but the contents of the plugin docs are duplicated in
the README.md of each plugin so that each package has a useful readme when published to npm. If you
are editing documentation for a plugin, keeping those changes in sync with the packages README files
is usually required. This is a temporary workaround until a better solution can be found.


### Reviewing documentation changes

Review both the resulting page and the documentation at the PR's base commit. For stacked PRs,
also compare the complete rewrite with the original base before the stack.

For each substantive removed explanation, setup step, option, caveat, or example, record where its
useful information is now covered. A review may accept consolidation, a linked replacement that
supports the same task, or removal of obsolete behavior verified against current source or upstream
documentation. Record the reason and evidence for each removal without a replacement. Shorter prose,
passing examples, and successful builds alone do not establish that coverage was preserved.

Check complete reader workflows: installation and initialization, connected examples, alternative
configurations, error handling, resource cleanup, and relevant limitations. Verify that shared
examples define the imports, models, and setup needed by the sections that refer to them. Treat an
unaccounted loss of useful coverage as a review finding and resolve it before approving the rewrite.

Keep the coverage mapping with the review results, alongside correctness and style findings. After
fixes, recheck the affected workflows and synchronize the plugin README. Large reductions deserve
extra scrutiny, but the same preservation check applies to small deletions.
