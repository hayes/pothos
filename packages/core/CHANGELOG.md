# Change Log

All notable changes to this project will be documented in this file.
See [Conventional Commits](https://conventionalcommits.org) for commit guidelines.

### 2.1.0 - 2021-04-16

**Note:** Version bump only for package @giraphql/core





## 2.1.0-alpha.0 - 2021-04-12

#### 🚀 Updates

- add giraphqlConfig to all extensions and add getInputTypeFieldConfigs method to build cache ([7d9c47f](https://github.com/hayes/giraphql/commit/7d9c47f))
- add new utils for mapping inputs fields in plugins ([be9fd1d](https://github.com/hayes/giraphql/commit/be9fd1d))
- add zod plugin ([5a77982](https://github.com/hayes/giraphql/commit/5a77982))
- build graphql types in specific order to make certain plugin use cases easier ([65b8942](https://github.com/hayes/giraphql/commit/65b8942))
- schemas are now sorted after being built ([154b51c](https://github.com/hayes/giraphql/commit/154b51c))

#### 🐞 Fixes

- args builder now coppies prototype methods from field builder so that extending FieldBuilder class works as expected ([bc8fd04](https://github.com/hayes/giraphql/commit/bc8fd04))
- correctly add extensions from giraphql options to build config objects for input fields ([33e59bc](https://github.com/hayes/giraphql/commit/33e59bc))

#### 📦 Dependencies

- update dev dependencies ([25a15d4](https://github.com/hayes/giraphql/commit/25a15d4))
- update dev deps ([cbfa0a4](https://github.com/hayes/giraphql/commit/cbfa0a4))

#### 📘 Docs

- add docs on mapping inputs ([eed4785](https://github.com/hayes/giraphql/commit/eed4785))

**Note:** Version bump only for package @giraphql/core





### 2.0.2 - 2021-03-16

**Note:** Version bump only for package @giraphql/core





### 2.0.1 - 2021-02-19

#### 🐞 Fixes

- correctly set deprecationReason ([cdc0c76](https://github.com/hayes/giraphql/commit/cdc0c76))

**Note:** Version bump only for package @giraphql/core





# 2.0.0 - 2021-02-16

#### 💥 Breaking

- update plugin API to avoid modifying args. subGraphs are now build by passing subGraph to toSchema ([66d456e](https://github.com/hayes/giraphql/commit/66d456e))
- update plugin exports and names to be more consistent ([ee07b35](https://github.com/hayes/giraphql/commit/ee07b35))

#### 🐞 Fixes

- use fieldOptionsByKind pattern for input field builder ([6ccf739](https://github.com/hayes/giraphql/commit/6ccf739))

#### 📦 Dependencies

- update dependencies and add license files ([cb0d102](https://github.com/hayes/giraphql/commit/cb0d102))

#### 📘 Docs

- add 2.0 migration guide ([48314c5](https://github.com/hayes/giraphql/commit/48314c5))
- add more docs o writing plugins ([b996fc6](https://github.com/hayes/giraphql/commit/b996fc6))
- wip - plugin guide ([cf9c6ec](https://github.com/hayes/giraphql/commit/cf9c6ec))

**Note:** Version bump only for package @giraphql/core





# 2.0.0-alpha.0 - 2021-02-10

#### 💥 Breaking

- remove field wrapper plugin api ([5d7af54](https://github.com/hayes/giraphql/commit/5d7af54))
- updated plugin API to initialize new plugins when calling toSchema ([05890db](https://github.com/hayes/giraphql/commit/05890db))
- you can no-longer define args on 'exposed' fields ([240162b](https://github.com/hayes/giraphql/commit/240162b))

#### 🚀 Updates

- add directives plugin ([b44ccde](https://github.com/hayes/giraphql/commit/b44ccde))

#### 🐞 Fixes

- add useGraphQLToolsUnorderedDirectives option to directive plugin ([a9e1ca6](https://github.com/hayes/giraphql/commit/a9e1ca6))

#### 📘 Docs

- add initial docs for scope auth plugin ([15b086d](https://github.com/hayes/giraphql/commit/15b086d))

#### 🛠 Internals

- add some basic scope-auth tests ([7ceb24a](https://github.com/hayes/giraphql/commit/7ceb24a))

**Note:** Version bump only for package @giraphql/core





### 1.6.0-alpha.1 - 2021-02-01

#### 🐞 Fixes

- add useGraphQLToolsUnorderedDirectives option to directive plugin ([6517dd4](https://github.com/hayes/giraphql/commit/6517dd4))

**Note:** Version bump only for package @giraphql/core





## 1.6.0-alpha.0 - 2021-02-01

#### 🚀 Updates

- add directives plugin ([ff76fe7](https://github.com/hayes/giraphql/commit/ff76fe7))

**Note:** Version bump only for package @giraphql/core





### 1.5.1 - 2021-01-26

#### 🐞 Fixes

- use thenable instead of types.isPromise to support custom promise implementations ([f5625e4](https://github.com/hayes/giraphql/commit/f5625e4))

**Note:** Version bump only for package @giraphql/core





### 1.5.0 - 2021-01-23

**Note:** Version bump only for package @giraphql/core





## 1.5.0-alpha.0 - 2021-01-23

#### 🚀 Updates

- improve error messages for unresolved refs and allow arguments to be implemented after references ([8c5a8b0](https://github.com/hayes/giraphql/commit/8c5a8b0))

**Note:** Version bump only for package @giraphql/core





### 1.4.0 - 2021-01-11

**Note:** Version bump only for package @giraphql/core





## 1.4.0-alpha.1 - 2021-01-10

#### 🚀 Updates

- only enable wrapping when a plugin with field wrapper is enabled ([1c24fcd](https://github.com/hayes/giraphql/commit/1c24fcd))
- remove extra async awaits in auth plugin ([fe9273d](https://github.com/hayes/giraphql/commit/fe9273d))
- significantly reduce number of awaits in resolve wrappers ([3dd028d](https://github.com/hayes/giraphql/commit/3dd028d))

**Note:** Version bump only for package @giraphql/core





# [1.1.0](https://github.com/hayes/giraphql/compare/@giraphql/core@1.1.0-alpha.0...@giraphql/core@1.1.0) (2020-10-21)

**Note:** Version bump only for package @giraphql/core





# Changelog

### 1.0.0

Initial release
