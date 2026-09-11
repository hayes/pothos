# Initial release review

See [docs/release-status.md](./docs/release-status.md) for implementation and
verification of the initial-release findings. Prior design discussions remain
in git history.

The governing design combines selection planning with optional multi-row fallback
loading through application-supplied model Collections. Production code uses the shared SQL family
without selecting or inspecting a database dialect.
