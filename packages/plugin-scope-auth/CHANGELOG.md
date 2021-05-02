# Change Log

All notable changes to this project will be documented in this file.
See [Conventional Commits](https://conventionalcommits.org) for commit guidelines.

### 2.0.3 - 2021-05-02

#### 🛠 Internals

- migrate to @beemo/dev for dev tool configs ([1da1283](https://github.com/hayes/giraphql/commit/1da1283))

**Note:** Version bump only for package @giraphql/plugin-scope-auth





### 2.0.2 - 2021-04-16

**Note:** Version bump only for package @giraphql/plugin-scope-auth





### 2.0.2-alpha.0 - 2021-04-12

#### 📦 Dependencies

- update dev dependencies ([25a15d4](https://github.com/hayes/giraphql/commit/25a15d4))
- update dev deps ([cbfa0a4](https://github.com/hayes/giraphql/commit/cbfa0a4))

**Note:** Version bump only for package @giraphql/plugin-scope-auth





### 2.0.1 - 2021-02-19

**Note:** Version bump only for package @giraphql/plugin-scope-auth





# 2.0.0 - 2021-02-16

#### 💥 Breaking

- update plugin API to avoid modifying args. subGraphs are now build by passing subGraph to toSchema ([66d456e](https://github.com/hayes/giraphql/commit/66d456e))
- update plugin exports and names to be more consistent ([ee07b35](https://github.com/hayes/giraphql/commit/ee07b35))

#### 📦 Dependencies

- update dependencies and add license files ([cb0d102](https://github.com/hayes/giraphql/commit/cb0d102))

#### 📘 Docs

- add more docs o writing plugins ([b996fc6](https://github.com/hayes/giraphql/commit/b996fc6))
- wip - plugin guide ([cf9c6ec](https://github.com/hayes/giraphql/commit/cf9c6ec))

**Note:** Version bump only for package @giraphql/plugin-scope-auth





# 2.0.0-alpha.0 - 2021-02-10

#### 💥 Breaking

- you can no-longer define args on 'exposed' fields ([240162b](https://github.com/hayes/giraphql/commit/240162b))

#### 🚀 Updates

- add option to disable scope auth during build ([c4f6bee](https://github.com/hayes/giraphql/commit/c4f6bee))
- add support for  scopes ([0b10ffd](https://github.com/hayes/giraphql/commit/0b10ffd))
- add support for authScope checks on interfaces ([fa6fe1e](https://github.com/hayes/giraphql/commit/fa6fe1e))
- add support for skipping type/interface scopes on specific fields ([34c95e3](https://github.com/hayes/giraphql/commit/34c95e3))

#### 🐞 Fixes

- bump auth plugin to 2.0 ([2bbb142](https://github.com/hayes/giraphql/commit/2bbb142))

#### 📘 Docs

- add initial docs for scope auth plugin ([15b086d](https://github.com/hayes/giraphql/commit/15b086d))

#### 🛠 Internals

- add some basic scope-auth tests ([7ceb24a](https://github.com/hayes/giraphql/commit/7ceb24a))
- add some caching tests ([0a08760](https://github.com/hayes/giraphql/commit/0a08760))
- add tests for authScope functions on fields ([324eb2f](https://github.com/hayes/giraphql/commit/324eb2f))
- add tests for authScope functions on types ([aed363a](https://github.com/hayes/giraphql/commit/aed363a))
- add tests for type authScopes ([951a6cd](https://github.com/hayes/giraphql/commit/951a6cd))

**Note:** Version bump only for package @giraphql/plugin-scope-auth
