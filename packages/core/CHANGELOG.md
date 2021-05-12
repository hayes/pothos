# Change Log

All notable changes to this project will be documented in this file.
See [Conventional Commits](https://conventionalcommits.org) for commit guidelines.

## 2.5.0 - 2021-05-12

#### 🚀 Updates

- allow plugins to remove fields ([9370ce1](https://github.com/hayes/giraphql/commit/9370ce1))
- update deno ([7d11693](https://github.com/hayes/giraphql/commit/7d11693))

#### 🛠 Internals

- add docs and tests for removing fields ([a3aa90e](https://github.com/hayes/giraphql/commit/a3aa90e))

**Note:** Version bump only for package @giraphql/core





### 2.4.2 - 2021-05-10

#### 🐞 Fixes

- update ci build command ([7e1d1d2](https://github.com/hayes/giraphql/commit/7e1d1d2))

**Note:** Version bump only for package @giraphql/core





### 2.4.1 - 2021-05-10

#### 🐞 Fixes

- build esm during release script ([172d4a2](https://github.com/hayes/giraphql/commit/172d4a2))

**Note:** Version bump only for package @giraphql/core





## 2.4.0 - 2021-05-10

#### 🚀 Updates

- add esm build for all packages ([d8bbdc9](https://github.com/hayes/giraphql/commit/d8bbdc9))

#### 📘 Docs

- fix a typo ([0f2bdbb](https://github.com/hayes/giraphql/commit/0f2bdbb))
- fix links in readme ([a950d39](https://github.com/hayes/giraphql/commit/a950d39))
- fix links in readme ([6132d42](https://github.com/hayes/giraphql/commit/6132d42))
- move website link higher in readme ([2260e33](https://github.com/hayes/giraphql/commit/2260e33))

**Note:** Version bump only for package @giraphql/core





### 2.3.0 - 2021-05-09

#### 📘 Docs

- update readmes ([07c727b](https://github.com/hayes/giraphql/commit/07c727b))

**Note:** Version bump only for package @giraphql/core





## 2.3.0-alpha.0 - 2021-05-08

#### 🚀 Updates

- add new context-cache util for safer context based caching ([c1656cf](https://github.com/hayes/giraphql/commit/c1656cf))
- add new ParentShape helper to enable refs with different resolve and parent types ([18d8b1c](https://github.com/hayes/giraphql/commit/18d8b1c))
- improve resolver types with better errors and async-generator support ([3e39492](https://github.com/hayes/giraphql/commit/3e39492))

**Note:** Version bump only for package @giraphql/core





### 2.2.1 - 2021-05-05

#### 🐞 Fixes

- add deno files after deno-build ([3f4f94b](https://github.com/hayes/giraphql/commit/3f4f94b))

**Note:** Version bump only for package @giraphql/core





### 2.2.0 - 2021-05-05

**Note:** Version bump only for package @giraphql/core





## 2.2.0-alpha.0 - 2021-05-05

#### 🚀 Updates

- add script for generating deno compatible files ([6dc68c1](https://github.com/hayes/giraphql/commit/6dc68c1))

**Note:** Version bump only for package @giraphql/core





### 2.1.2 - 2021-05-02

#### 🛠 Internals

- force version bumps and update validation to 2.0 range ([07730b3](https://github.com/hayes/giraphql/commit/07730b3))

**Note:** Version bump only for package @giraphql/core





### 2.1.1 - 2021-05-02

#### 🛠 Internals

- migrate to @beemo/dev for dev tool configs ([1da1283](https://github.com/hayes/giraphql/commit/1da1283))

**Note:** Version bump only for package @giraphql/core





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
