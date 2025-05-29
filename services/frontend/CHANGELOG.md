# Changelog

# [0.12.0](https://github.com/Lasim/deploystack-v1/compare/frontend-v0.11.0...frontend-v0.12.0) (2025-03-17)


### Bug Fixes

* update Dockerfile CMD to use shell and increment response value in index route ([506fc24](https://github.com/Lasim/deploystack-v1/commit/506fc241ccadd1cea8b8c4bb59bb0acf8d76c8b3))
* update Dockerfiles to streamline CMD and add runtime environment variable handling ([1cd8a9a](https://github.com/Lasim/deploystack-v1/commit/1cd8a9a0d3f8dbdf5da46def0bbf610c13e11912))
* update title in index.html to reflect version 7 and adjust TypeScript ignore comments in env.ts ([e4874cf](https://github.com/Lasim/deploystack-v1/commit/e4874cfb0897e5220b2820e4f215a6031653515a))
* update title in index.html to reflect version 8 and improve TypeScript handling in env.ts ([a5febae](https://github.com/Lasim/deploystack-v1/commit/a5febae1074c8671824d1597434f525db8bae665))

# [0.11.0](https://github.com/Lasim/deploystack-v1/compare/frontend-v0.10.0...frontend-v0.11.0) (2025-03-16)


### Bug Fixes

* remove environment variable display from Login.vue ([9201fba](https://github.com/Lasim/deploystack-v1/commit/9201fbad774048955ea6251f5d29fc7ffcbefd65))
* simplify environment variable display in Login.vue ([ed6cc91](https://github.com/Lasim/deploystack-v1/commit/ed6cc91e19f20fd668f4b0aedd77c5f1dfb8cf06))
* update README with Docker run command and add environment variable display in Login.vue ([82c95cb](https://github.com/Lasim/deploystack-v1/commit/82c95cbf904e9ccfcff65c7285622be4e8b7c934))
* update title in index.html to reflect version 6 ([7f3e198](https://github.com/Lasim/deploystack-v1/commit/7f3e19824faa7a1d786c39a848d9309b737ec671))

# [0.10.0](https://github.com/Lasim/deploystack-v1/compare/frontend-v0.9.0...frontend-v0.10.0) (2025-03-16)


### Bug Fixes

* add logging for dist directory contents after build step in frontend release workflow ([699f096](https://github.com/Lasim/deploystack-v1/commit/699f0967fe496efda483f1c7eba6c0915394cea4))
* update frontend release workflow and README, increment version in index.html ([6f40d06](https://github.com/Lasim/deploystack-v1/commit/6f40d069393894e39f1cafaad9d53c91a175799f))

# [0.9.0](https://github.com/Lasim/deploystack-v1/compare/frontend-v0.8.0...frontend-v0.9.0) (2025-03-16)


### Bug Fixes

* reorder backend release workflow steps for improved versioning and build process ([3cd89ac](https://github.com/Lasim/deploystack-v1/commit/3cd89acdc52ec6e0c4bdb1066aabe492a0fc9b83))
* streamline backend release workflow and Dockerfile for improved build process ([b206e57](https://github.com/Lasim/deploystack-v1/commit/b206e57b7ac522030e517b3097bbe8c71189a259))
* update backend Dockerfile to copy node_modules and modify response message in index route ([713457f](https://github.com/Lasim/deploystack-v1/commit/713457f4f7fe21ff981de172991f3dba85b430a9))
* update backend Dockerfile to prepare shared resources and modify server listening host ([e322ad0](https://github.com/Lasim/deploystack-v1/commit/e322ad01c80a94558287d0126b621b967818703d))
* update backend release workflow and Dockerfile to include version build argument and display it in startup banner ([6d2890f](https://github.com/Lasim/deploystack-v1/commit/6d2890f819fb34a542f2eeb8879bd3587ef18e74))
* update backend release workflow and modify response message in index route ([a8e5b90](https://github.com/Lasim/deploystack-v1/commit/a8e5b902d8a656384b2cdcdd212119a66f8e325d))
* update backend release workflow to include environment variable in startup banner and streamline shared directory setup ([04baf3f](https://github.com/Lasim/deploystack-v1/commit/04baf3fd063748f4bb6ee918f42a1577832dad9b))
* update backend release workflow to install dependencies before building ([60e26d4](https://github.com/Lasim/deploystack-v1/commit/60e26d4f872e2227afad0406f24ba083ae6afdeb))
* update backend release workflow to install production dependencies and modify response message in index route ([d015d88](https://github.com/Lasim/deploystack-v1/commit/d015d88272ecf134e402c388f71ea082849d0bce))
* update backend release workflow to remove npm install and modify response message in index route ([ea43bd1](https://github.com/Lasim/deploystack-v1/commit/ea43bd126d8ec9073fd3975cd1792a15a01510f3))
* update backend release workflow to streamline dependency installation and modify response message in index route ([87a8273](https://github.com/Lasim/deploystack-v1/commit/87a8273fdb71af8b7e99c395bf6e3701b2f5748d))
* update backend release workflow to use npm ci and modify response message in index route ([80dd941](https://github.com/Lasim/deploystack-v1/commit/80dd941dc5414cddea066bf8d89c249ce01dbc73))
* update backend release workflow to use npm install and modify response message in index route ([acb7547](https://github.com/Lasim/deploystack-v1/commit/acb7547353c680ec4d8b41531f48cc744136fe1e))
* update backend release workflow to use npm install instead of npm ci ([a60d770](https://github.com/Lasim/deploystack-v1/commit/a60d7705f214164703e94dcc4d1a1dc96bc99298))
* update Dockerfile to install all dependencies and modify response message in index route ([f8a7b15](https://github.com/Lasim/deploystack-v1/commit/f8a7b154e81f2aa44b9c78f8111d08c947e4bf6d))
* update Dockerfile to install only production dependencies and modify response message in index route ([d1c9258](https://github.com/Lasim/deploystack-v1/commit/d1c92583ff206b2200a1f4ba5b0688e5db5e897f))
* update Dockerfile to install only production dependencies and modify response message in index route ([9a141d6](https://github.com/Lasim/deploystack-v1/commit/9a141d67bb63d984928d3c3f3e88f7352d11c341))
* update Dockerfile to run application with environment file and modify response message in index route ([0d160c4](https://github.com/Lasim/deploystack-v1/commit/0d160c44bb0187b9f1d130cdaa85d604b7c5571a))
* update Dockerfile to set environment variables in .env file and modify response message in index route ([dfefd89](https://github.com/Lasim/deploystack-v1/commit/dfefd890194d9492d7992052d8c8b47a1f84b34d))
* update frontend build process to use version environment variable and clean install dependencies ([6c66b04](https://github.com/Lasim/deploystack-v1/commit/6c66b04eb84b750d5ab2d2a021ed86c1b7ceee9b))
* update frontend release workflow to remove package-lock.json and install dependencies, and increment frontend version in index.html ([c186f90](https://github.com/Lasim/deploystack-v1/commit/c186f907e31c6b28deafd5d649aeb9bacc1f293c))
* update frontend release workflow to streamline version management and build process ([5d3f18c](https://github.com/Lasim/deploystack-v1/commit/5d3f18cf0a7a67bf71642a0f3abf46aa6b0eba26))
* update README to reflect new environment variable value and add volume mapping ([40aa2c2](https://github.com/Lasim/deploystack-v1/commit/40aa2c26bca24d2640e01d180426c2d564145af2))
* update response message in index route to reflect new value ([f6edd8c](https://github.com/Lasim/deploystack-v1/commit/f6edd8c031259353049a49f7f846a7ec7b05c8a0))
* update response message in index route to reflect new value ([d296c54](https://github.com/Lasim/deploystack-v1/commit/d296c54cc0b7c719e2b9e9c594e7cb77f47bf133))

# 0.8.0 (2025-03-15)

### Features
* Release version 0.8.0

# 0.7.0 (2025-03-15)

### Features
* Release version 0.7.0

# 0.6.0 (2025-03-15)

### Features
* Release version 0.6.0

# 0.5.0 (2025-03-15)

### Features
* Release version 0.5.0

# 0.4.0 (2025-03-14)

### Features
* Release version 0.4.0

# 0.3.0 (2025-03-14)

### Features
* Release version 0.3.0

# 0.2.0 (2025-03-12)

### Features
* Release version 0.2.0
