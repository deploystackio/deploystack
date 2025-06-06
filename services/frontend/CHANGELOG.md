# Changelog

## [0.12.6](https://github.com/deploystackio/deploystack/compare/frontend-v0.12.4...frontend-v0.12.6) (2025-05-31)


### chore

* **frontend:** release v0.12.5 ([](https://github.com/deploystackio/deploystack/commit/4f33ea81866cf6a2507de484654d0eea78bf1e6e))


### fix

* update Docker run command to map port 8080 to 80 for frontend ([](https://github.com/deploystackio/deploystack/commit/538d5fc28f8e3b74fa6b71cf112e328ec0d97f57))
* update favicon.ico for improved branding ([](https://github.com/deploystackio/deploystack/commit/e5d3ba5b0744ee05ac7253ca2538bff06a16e6ac))
* update storage key handling in DatabaseService to use dynamic baseUrl ([](https://github.com/deploystackio/deploystack/commit/9b613f5d4633f1b89fcdb08f1274c6dce43ff088))

## [0.12.5](https://github.com/deploystackio/deploystack/compare/frontend-v0.12.4...frontend-v0.12.5) (2025-05-31)


### fix

* update Docker run command to map port 8080 to 80 for frontend ([](https://github.com/deploystackio/deploystack/commit/538d5fc28f8e3b74fa6b71cf112e328ec0d97f57))
* update favicon.ico for improved branding ([](https://github.com/deploystackio/deploystack/commit/e5d3ba5b0744ee05ac7253ca2538bff06a16e6ac))
* update storage key handling in DatabaseService to use dynamic baseUrl ([](https://github.com/deploystackio/deploystack/commit/9b613f5d4633f1b89fcdb08f1274c6dce43ff088))

## [0.12.4](https://github.com/deploystackio/deploystack/compare/frontend-v0.12.2...frontend-v0.12.4) (2025-05-30)


### chore

* **frontend:** release v0.12.3 ([](https://github.com/deploystackio/deploystack/commit/82e896cbb1911753834dee0482abf674b9bcfbab))


### fix

* enhance error handling for database connection and update error messages ([](https://github.com/deploystackio/deploystack/commit/b25524556ed0aa92b3873f2460d1f9cd622f8e5f))
* update conventional changelog plugin configuration for backend and frontend ([](https://github.com/deploystackio/deploystack/commit/bbcfbf4da3edec1de943605fa1482aa6bab5b9fd))
* update Docker run command for frontend environment variables ([](https://github.com/deploystackio/deploystack/commit/348b77aaf69c170e6e57184406270e9e55c728ac))


### frontend

* update environment variable references to use VITE_DEPLOYSTACK_APP_URL ([](https://github.com/deploystackio/deploystack/commit/d7361d562a0a22569cc910fd422bdb91318b6595))

## [0.12.3](https://github.com/deploystackio/deploystack/compare/frontend-v0.12.2...frontend-v0.12.3) (2025-05-30)


### fix

* enhance error handling for database connection and update error messages ([](https://github.com/deploystackio/deploystack/commit/b25524556ed0aa92b3873f2460d1f9cd622f8e5f))
* update conventional changelog plugin configuration for backend and frontend ([](https://github.com/deploystackio/deploystack/commit/bbcfbf4da3edec1de943605fa1482aa6bab5b9fd))
* update Docker run command for frontend environment variables ([](https://github.com/deploystackio/deploystack/commit/348b77aaf69c170e6e57184406270e9e55c728ac))


### frontend

* update environment variable references to use VITE_DEPLOYSTACK_APP_URL ([](https://github.com/deploystackio/deploystack/commit/d7361d562a0a22569cc910fd422bdb91318b6595))

## 0.12.2 (2025-05-30)


* Implement role-based access control middleware and role management routes ([](https://github.com/deploystackio/deploystack/commit/6ba5c0e953e839efef8411ba6503395025e09543))
* Refactor database handling and plugin system to improve type safety and clarity ([](https://github.com/deploystackio/deploystack/commit/7a9d5f3fa219a0a7310a3c4855db132d1ee26e0d))
* Add check for existing database configuration in setup handler ([](https://github.com/deploystackio/deploystack/commit/4ddba0667355ee3d4b508a9352b4f333ae1df5c3))
* Refactor database schema and plugin system for improved flexibility and type safety ([](https://github.com/deploystackio/deploystack/commit/37cb9a9bdeb3c4e4a0042268f11a785ddf969f4e))
* update CHANGELOG.md for frontend service, removing old version entries and maintaining structure ([](https://github.com/deploystackio/deploystack/commit/693df3cfc18717c673e02c66a1b8221e4a1633e2))
* init ([](https://github.com/deploystackio/deploystack/commit/df4a4b7defae72dcd66ba163928424b571ae3124))


### chore

* **all:** bump @tailwindcss/postcss from 4.1.7 to 4.1.8 ([](https://github.com/deploystackio/deploystack/commit/4d44d52bbe6f8e2dac77c7843c886cb729e680e6))
* **all:** bump @tailwindcss/vite from 4.1.7 to 4.1.8 ([](https://github.com/deploystackio/deploystack/commit/d45e65d4c6bcfec22ea9005f3e9d039feace65a6))
* **all:** bump @types/node from 22.15.21 to 22.15.24 ([](https://github.com/deploystackio/deploystack/commit/8f7ef5298c05430b1b1575d7cf7f0c8e695b2145))
* **all:** bump @typescript-eslint/eslint-plugin from 8.32.1 to 8.33.0 ([](https://github.com/deploystackio/deploystack/commit/517d6d91301b721ee53b09b904707c1277db5030))
* **all:** bump @typescript-eslint/parser from 8.32.1 to 8.33.0 ([](https://github.com/deploystackio/deploystack/commit/4835b231d339a478214556dadc47eabe34391747))
* **all:** bump drizzle-orm from 0.43.1 to 0.44.0 ([](https://github.com/deploystackio/deploystack/commit/90ceb36c97d05279a5cf6aff491092853aa0aed9))
* **all:** bump tailwindcss from 4.1.7 to 4.1.8 ([](https://github.com/deploystackio/deploystack/commit/cf562f495e73ce6755e3609469526d6a67a8ac64))
* **all:** bump typescript-eslint from 8.32.1 to 8.33.0 ([](https://github.com/deploystackio/deploystack/commit/cc0f45558bf5ef036ae0cc327482b2cd81505a1f))
* **all:** bump vue from 3.5.15 to 3.5.16 ([](https://github.com/deploystackio/deploystack/commit/6a4262662872b42d6686bd61daf3d3a14bf610c7))
* **all:** bump vue-i18n from 11.1.4 to 11.1.5 ([](https://github.com/deploystackio/deploystack/commit/2d1720f95fcb8c431144e9f94f2bb3222b7ca12f))
* **all:** bump zod from 3.25.28 to 3.25.36 ([](https://github.com/deploystackio/deploystack/commit/a30192500b5b2498697985d48c6debfdff99a7b7))
* **frontend:** release v0.12.1 ([](https://github.com/deploystackio/deploystack/commit/a6d134987ca5aaaffefc90a13287d4ff62e74564))
* update backend version to 0.20.2 and typescript-eslint to 8.33.0 ([](https://github.com/deploystackio/deploystack/commit/bc015afd966ad8b304c619e00de57d57dcf583b8))


### docs

* update database setup instructions and clarify persistent data directory usage ([](https://github.com/deploystackio/deploystack/commit/59bec6fab64ce94c472b0a4c3047be2842fdc3bc))


### feat

* add CORS support and database setup functionality ([](https://github.com/deploystackio/deploystack/commit/35e30a6eb1a3cbf528e9d9d729de868d9377fb8c))
* add CORS support and database setup functionality ([](https://github.com/deploystackio/deploystack/commit/02e0c63e0eb3dacbfb079073c70b5b596695355c))
* enhance backend and frontend release workflows with app token and cleanup branch automation ([](https://github.com/deploystackio/deploystack/commit/6505a71a7e0c224b438bfae38cd3b663367be7d4))
* enhance database schema and authentication flow with foreign key constraints and session management improvements ([](https://github.com/deploystackio/deploystack/commit/55745474a9c0604c67499c2c48dc420f856ecaf1))


### fix

* add overrides for esbuild version in package.json ([](https://github.com/deploystackio/deploystack/commit/d40d6fa515b4962033fd0869970370c98df8aaa5))
* add permissions for issues in backend release workflow ([](https://github.com/deploystackio/deploystack/commit/de0d463e0dd5c6eac8eafd621d88e7821b457138))
* clean up empty markdown links and remove empty lines from release notes extraction ([](https://github.com/deploystackio/deploystack/commit/a3d1c14474b5ecfc94f87ec3ecd295954d732d5e))
* correct formatting in package.json overrides section ([](https://github.com/deploystackio/deploystack/commit/021f5b218e6071fba2216a9c9e3b3563b8693e99))
* enhance error handling in login and registration forms with improved type safety and user feedback ([](https://github.com/deploystackio/deploystack/commit/d3f9fc74f0f2981cf67eb9b7ee1fa4d7b3995351))
* enhance frontend release workflow with improved dependency installation and build handling ([](https://github.com/deploystackio/deploystack/commit/4eaca2e3658460096e06bc8c16070d664ebb153a))
* enhance release notes extraction in backend release workflow ([](https://github.com/deploystackio/deploystack/commit/838a2b7e982014fb287c5c58f97d562e98bc17aa))
* improve frontend release workflow with enhanced dependency installation and release notes extraction ([](https://github.com/deploystackio/deploystack/commit/d50e10a846f93380d3f31201bc1557934bbede59))
* improve session handling in email login route with manual session creation and error logging ([](https://github.com/deploystackio/deploystack/commit/b0d0474c150ec0f34cba3847241aaaefd34e080b))
* remove unnecessary imports and add eslint disable comments for explicit any types ([](https://github.com/deploystackio/deploystack/commit/960303e4d61220a2090a193a0567979d8b55cc57))
* resolve merge conflict and update typescript-eslint version in package.json ([](https://github.com/deploystackio/deploystack/commit/861b4c25b19efa013f417b8a54cca27623ffd248))
* update backend release workflow to use app token for GitHub actions ([](https://github.com/deploystackio/deploystack/commit/561c71cb706bcc0151f010ed2a05952fea6ad0bc))
* update login API endpoint to use new email-based authentication ([](https://github.com/deploystackio/deploystack/commit/f54932294f251e27fea56b2eca0e5b20ee2bd1dd))
* update login form error handling and improve user feedback ([](https://github.com/deploystackio/deploystack/commit/b2fc87bdf85fb60a41ecbf1b8395c8f2ce1c7eec))
* update release notes extraction to reference the correct paths for version and changelog ([](https://github.com/deploystackio/deploystack/commit/d45e9d406bbe538f9d05234f490f4e662f7ad587))
* update release type options to remove 'auto' and set default to 'patch' ([](https://github.com/deploystackio/deploystack/commit/f4a50d671a493eac5369d706038faa66c337dfcb))
* update security documentation to clarify key security dependencies ([](https://github.com/deploystackio/deploystack/commit/88f41bedb6d2d778a74e5d7af0e4ec7724a1e799))


### refactor

* remove unused type imports and suppress eslint warnings for 'any' usage ([](https://github.com/deploystackio/deploystack/commit/0cc9136bb7b0cc936397d67833b58dba1c6fe2e4))

## 0.12.1 (2025-05-30)


* Implement role-based access control middleware and role management routes ([](https://github.com/deploystackio/deploystack/commit/6ba5c0e953e839efef8411ba6503395025e09543))
* Refactor database handling and plugin system to improve type safety and clarity ([](https://github.com/deploystackio/deploystack/commit/7a9d5f3fa219a0a7310a3c4855db132d1ee26e0d))
* Add check for existing database configuration in setup handler ([](https://github.com/deploystackio/deploystack/commit/4ddba0667355ee3d4b508a9352b4f333ae1df5c3))
* Refactor database schema and plugin system for improved flexibility and type safety ([](https://github.com/deploystackio/deploystack/commit/37cb9a9bdeb3c4e4a0042268f11a785ddf969f4e))
* update CHANGELOG.md for frontend service, removing old version entries and maintaining structure ([](https://github.com/deploystackio/deploystack/commit/693df3cfc18717c673e02c66a1b8221e4a1633e2))
* init ([](https://github.com/deploystackio/deploystack/commit/df4a4b7defae72dcd66ba163928424b571ae3124))


### chore

* **all:** bump @tailwindcss/postcss from 4.1.7 to 4.1.8 ([](https://github.com/deploystackio/deploystack/commit/4d44d52bbe6f8e2dac77c7843c886cb729e680e6))
* **all:** bump @tailwindcss/vite from 4.1.7 to 4.1.8 ([](https://github.com/deploystackio/deploystack/commit/d45e65d4c6bcfec22ea9005f3e9d039feace65a6))
* **all:** bump @types/node from 22.15.21 to 22.15.24 ([](https://github.com/deploystackio/deploystack/commit/8f7ef5298c05430b1b1575d7cf7f0c8e695b2145))
* **all:** bump @typescript-eslint/eslint-plugin from 8.32.1 to 8.33.0 ([](https://github.com/deploystackio/deploystack/commit/517d6d91301b721ee53b09b904707c1277db5030))
* **all:** bump @typescript-eslint/parser from 8.32.1 to 8.33.0 ([](https://github.com/deploystackio/deploystack/commit/4835b231d339a478214556dadc47eabe34391747))
* **all:** bump drizzle-orm from 0.43.1 to 0.44.0 ([](https://github.com/deploystackio/deploystack/commit/90ceb36c97d05279a5cf6aff491092853aa0aed9))
* **all:** bump tailwindcss from 4.1.7 to 4.1.8 ([](https://github.com/deploystackio/deploystack/commit/cf562f495e73ce6755e3609469526d6a67a8ac64))
* **all:** bump typescript-eslint from 8.32.1 to 8.33.0 ([](https://github.com/deploystackio/deploystack/commit/cc0f45558bf5ef036ae0cc327482b2cd81505a1f))
* **all:** bump vue from 3.5.15 to 3.5.16 ([](https://github.com/deploystackio/deploystack/commit/6a4262662872b42d6686bd61daf3d3a14bf610c7))
* **all:** bump vue-i18n from 11.1.4 to 11.1.5 ([](https://github.com/deploystackio/deploystack/commit/2d1720f95fcb8c431144e9f94f2bb3222b7ca12f))
* **all:** bump zod from 3.25.28 to 3.25.36 ([](https://github.com/deploystackio/deploystack/commit/a30192500b5b2498697985d48c6debfdff99a7b7))
* update backend version to 0.20.2 and typescript-eslint to 8.33.0 ([](https://github.com/deploystackio/deploystack/commit/bc015afd966ad8b304c619e00de57d57dcf583b8))


### docs

* update database setup instructions and clarify persistent data directory usage ([](https://github.com/deploystackio/deploystack/commit/59bec6fab64ce94c472b0a4c3047be2842fdc3bc))


### feat

* add CORS support and database setup functionality ([](https://github.com/deploystackio/deploystack/commit/35e30a6eb1a3cbf528e9d9d729de868d9377fb8c))
* add CORS support and database setup functionality ([](https://github.com/deploystackio/deploystack/commit/02e0c63e0eb3dacbfb079073c70b5b596695355c))
* enhance backend and frontend release workflows with app token and cleanup branch automation ([](https://github.com/deploystackio/deploystack/commit/6505a71a7e0c224b438bfae38cd3b663367be7d4))
* enhance database schema and authentication flow with foreign key constraints and session management improvements ([](https://github.com/deploystackio/deploystack/commit/55745474a9c0604c67499c2c48dc420f856ecaf1))


### fix

* add overrides for esbuild version in package.json ([](https://github.com/deploystackio/deploystack/commit/d40d6fa515b4962033fd0869970370c98df8aaa5))
* add permissions for issues in backend release workflow ([](https://github.com/deploystackio/deploystack/commit/de0d463e0dd5c6eac8eafd621d88e7821b457138))
* clean up empty markdown links and remove empty lines from release notes extraction ([](https://github.com/deploystackio/deploystack/commit/a3d1c14474b5ecfc94f87ec3ecd295954d732d5e))
* correct formatting in package.json overrides section ([](https://github.com/deploystackio/deploystack/commit/021f5b218e6071fba2216a9c9e3b3563b8693e99))
* enhance error handling in login and registration forms with improved type safety and user feedback ([](https://github.com/deploystackio/deploystack/commit/d3f9fc74f0f2981cf67eb9b7ee1fa4d7b3995351))
* enhance frontend release workflow with improved dependency installation and build handling ([](https://github.com/deploystackio/deploystack/commit/4eaca2e3658460096e06bc8c16070d664ebb153a))
* enhance release notes extraction in backend release workflow ([](https://github.com/deploystackio/deploystack/commit/838a2b7e982014fb287c5c58f97d562e98bc17aa))
* improve frontend release workflow with enhanced dependency installation and release notes extraction ([](https://github.com/deploystackio/deploystack/commit/d50e10a846f93380d3f31201bc1557934bbede59))
* improve session handling in email login route with manual session creation and error logging ([](https://github.com/deploystackio/deploystack/commit/b0d0474c150ec0f34cba3847241aaaefd34e080b))
* remove unnecessary imports and add eslint disable comments for explicit any types ([](https://github.com/deploystackio/deploystack/commit/960303e4d61220a2090a193a0567979d8b55cc57))
* resolve merge conflict and update typescript-eslint version in package.json ([](https://github.com/deploystackio/deploystack/commit/861b4c25b19efa013f417b8a54cca27623ffd248))
* update backend release workflow to use app token for GitHub actions ([](https://github.com/deploystackio/deploystack/commit/561c71cb706bcc0151f010ed2a05952fea6ad0bc))
* update login API endpoint to use new email-based authentication ([](https://github.com/deploystackio/deploystack/commit/f54932294f251e27fea56b2eca0e5b20ee2bd1dd))
* update login form error handling and improve user feedback ([](https://github.com/deploystackio/deploystack/commit/b2fc87bdf85fb60a41ecbf1b8395c8f2ce1c7eec))
* update release notes extraction to reference the correct paths for version and changelog ([](https://github.com/deploystackio/deploystack/commit/d45e9d406bbe538f9d05234f490f4e662f7ad587))
* update release type options to remove 'auto' and set default to 'patch' ([](https://github.com/deploystackio/deploystack/commit/f4a50d671a493eac5369d706038faa66c337dfcb))
* update security documentation to clarify key security dependencies ([](https://github.com/deploystackio/deploystack/commit/88f41bedb6d2d778a74e5d7af0e4ec7724a1e799))


### refactor

* remove unused type imports and suppress eslint warnings for 'any' usage ([](https://github.com/deploystackio/deploystack/commit/0cc9136bb7b0cc936397d67833b58dba1c6fe2e4))
