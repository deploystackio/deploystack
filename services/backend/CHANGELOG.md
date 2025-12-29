# Changelog

## 0.56.0 (2025-12-29)

* feat(all): add MCP servers page to admin teams detail with pagination ([6186e7bb519b493e2d4e7354d9ae694beb2b1186](https://github.com/deploystackio/deploystack/commit/6186e7bb519b493e2d4e7354d9ae694beb2b1186))
* feat(all): add OAuth re-authentication for MCP installations ([f08e92a29ba06850def5a9dac17f5cc19be6a5a5](https://github.com/deploystackio/deploystack/commit/f08e92a29ba06850def5a9dac17f5cc19be6a5a5))
* feat(all): add per-team remote MCP server permission - global setting ([69ace9d7f15c1b26857f3c6528a4d161e58d2466](https://github.com/deploystackio/deploystack/commit/69ace9d7f15c1b26857f3c6528a4d161e58d2466))
* feat(all): make team member limits configurable per-team ([1c70523ce3d0e83ea4c1032ca4dce7fca48ca869](https://github.com/deploystackio/deploystack/commit/1c70523ce3d0e83ea4c1032ca4dce7fca48ca869))
* feat(backend): add endpoint to retrieve team MCP installations with pagination for global_admin ([765b4555d1ef0ee4096a8c43e9e712d14af69645](https://github.com/deploystackio/deploystack/commit/765b4555d1ef0ee4096a8c43e9e712d14af69645))
* feat(backend): add pagination and search to admin teams endpoints ([35c79a17ad807fcad7f688d2a1264421cc47b478](https://github.com/deploystackio/deploystack/commit/35c79a17ad807fcad7f688d2a1264421cc47b478))
* feat(backend): add pagination and search to user endpoints ([dca989fcdf9199968ef6ce0e6c745c16b80dcca9](https://github.com/deploystackio/deploystack/commit/dca989fcdf9199968ef6ce0e6c745c16b80dcca9))
* refactor(backend): remove deprecated Gateway CLI code after Satellite pivot ([87a28186e21504a6abe5f6487aaf4bee05a43639](https://github.com/deploystackio/deploystack/commit/87a28186e21504a6abe5f6487aaf4bee05a43639))
* refactor(backend): separate team settings into dedicated settings group ([86a25126afc1fb44afce07bc496250b97fc83022](https://github.com/deploystackio/deploystack/commit/86a25126afc1fb44afce07bc496250b97fc83022))
* docs(all): update project description for clarity and focus ([cbbfcf6f1392f8a357075b4c0447357bd647cac9](https://github.com/deploystackio/deploystack/commit/cbbfcf6f1392f8a357075b4c0447357bd647cac9))


### BREAKING CHANGE

* Admin teams list endpoint response structure changed from flat array to paginated format

- Add pagination support to GET /api/admin/teams endpoint
  - Query params: limit (1-100, default 20), offset (default 0)
  - Response now includes data.teams and data.pagination metadata
  - Pagination metadata: total, limit, offset, has_more
- Create new GET /api/admin/teams/search endpoint
  - Filter by team name (partial, case-insensitive)
  - Includes same pagination support as list endpoint
- Add pagination schemas and validation helper to admin/teams/schemas.ts
- Register search route in admin teams index
- Update API specs (api-spec.json, api-spec.yaml)
* GET /users response format changed from { success, data: [...] } to { success, data: { users: [...], pagination: {...} } }

## 0.56.0 (2025-12-28)

* feat(all): add MCP servers page to admin teams detail with pagination ([6186e7bb519b493e2d4e7354d9ae694beb2b1186](https://github.com/deploystackio/deploystack/commit/6186e7bb519b493e2d4e7354d9ae694beb2b1186))
* feat(all): add OAuth re-authentication for MCP installations ([f08e92a29ba06850def5a9dac17f5cc19be6a5a5](https://github.com/deploystackio/deploystack/commit/f08e92a29ba06850def5a9dac17f5cc19be6a5a5))
* feat(all): add per-team remote MCP server permission - global setting ([69ace9d7f15c1b26857f3c6528a4d161e58d2466](https://github.com/deploystackio/deploystack/commit/69ace9d7f15c1b26857f3c6528a4d161e58d2466))
* feat(all): make team member limits configurable per-team ([1c70523ce3d0e83ea4c1032ca4dce7fca48ca869](https://github.com/deploystackio/deploystack/commit/1c70523ce3d0e83ea4c1032ca4dce7fca48ca869))
* feat(backend): add endpoint to retrieve team MCP installations with pagination for global_admin ([765b4555d1ef0ee4096a8c43e9e712d14af69645](https://github.com/deploystackio/deploystack/commit/765b4555d1ef0ee4096a8c43e9e712d14af69645))
* feat(backend): add pagination and search to admin teams endpoints ([35c79a17ad807fcad7f688d2a1264421cc47b478](https://github.com/deploystackio/deploystack/commit/35c79a17ad807fcad7f688d2a1264421cc47b478))
* feat(backend): add pagination and search to user endpoints ([dca989fcdf9199968ef6ce0e6c745c16b80dcca9](https://github.com/deploystackio/deploystack/commit/dca989fcdf9199968ef6ce0e6c745c16b80dcca9))
* refactor(backend): remove deprecated Gateway CLI code after Satellite pivot ([87a28186e21504a6abe5f6487aaf4bee05a43639](https://github.com/deploystackio/deploystack/commit/87a28186e21504a6abe5f6487aaf4bee05a43639))
* refactor(backend): separate team settings into dedicated settings group ([86a25126afc1fb44afce07bc496250b97fc83022](https://github.com/deploystackio/deploystack/commit/86a25126afc1fb44afce07bc496250b97fc83022))
* docs(all): update project description for clarity and focus ([cbbfcf6f1392f8a357075b4c0447357bd647cac9](https://github.com/deploystackio/deploystack/commit/cbbfcf6f1392f8a357075b4c0447357bd647cac9))


### BREAKING CHANGE

* Admin teams list endpoint response structure changed from flat array to paginated format

- Add pagination support to GET /api/admin/teams endpoint
  - Query params: limit (1-100, default 20), offset (default 0)
  - Response now includes data.teams and data.pagination metadata
  - Pagination metadata: total, limit, offset, has_more
- Create new GET /api/admin/teams/search endpoint
  - Filter by team name (partial, case-insensitive)
  - Includes same pagination support as list endpoint
- Add pagination schemas and validation helper to admin/teams/schemas.ts
- Register search route in admin teams index
- Update API specs (api-spec.json, api-spec.yaml)
* GET /users response format changed from { success, data: [...] } to { success, data: { users: [...], pagination: {...} } }

## 0.55.0 (2025-12-24)

* feat(all): add real-time SSE streaming for MCP installations list ([420b99e99af44ae12cd04dca5a05eb60a130aad2](https://github.com/deploystackio/deploystack/commit/420b99e99af44ae12cd04dca5a05eb60a130aad2))
* feat(backend): add SSE endpoint for real-time MCP installation status streaming ([198bd9eaba4123a184752f9c77c1746766ad91b3](https://github.com/deploystackio/deploystack/commit/198bd9eaba4123a184752f9c77c1746766ad91b3))
* feat(backend): optimize installation data retrieval for list views ([85ffc4c4bdd9a0fe43bdf86eb3dd48d93f645ae2](https://github.com/deploystackio/deploystack/commit/85ffc4c4bdd9a0fe43bdf86eb3dd48d93f645ae2))
* chore(all): bump vite from 7.2.7 to 7.3.0 ([35da3c2261eb8218b9b81f0815f54fc62f8c4e27](https://github.com/deploystackio/deploystack/commit/35da3c2261eb8218b9b81f0815f54fc62f8c4e27))

## 0.55.0 (2025-12-24)

* feat(all): add real-time SSE streaming for MCP installations list ([420b99e99af44ae12cd04dca5a05eb60a130aad2](https://github.com/deploystackio/deploystack/commit/420b99e99af44ae12cd04dca5a05eb60a130aad2))
* feat(backend): add SSE endpoint for real-time MCP installation status streaming ([198bd9eaba4123a184752f9c77c1746766ad91b3](https://github.com/deploystackio/deploystack/commit/198bd9eaba4123a184752f9c77c1746766ad91b3))
* feat(backend): optimize installation data retrieval for list views ([85ffc4c4bdd9a0fe43bdf86eb3dd48d93f645ae2](https://github.com/deploystackio/deploystack/commit/85ffc4c4bdd9a0fe43bdf86eb3dd48d93f645ae2))
* chore(all): bump vite from 7.2.7 to 7.3.0 ([35da3c2261eb8218b9b81f0815f54fc62f8c4e27](https://github.com/deploystackio/deploystack/commit/35da3c2261eb8218b9b81f0815f54fc62f8c4e27))

## 0.54.0 (2025-12-19)

* feat(all): Add MCP installation settings, request logs API, and SSE streaming 5f44e43c5fa95527676acc3302c1ac8e764cefe5
* feat(backend): add batch toggle tool disabled status endpoint 2b654884f44e75b0abfd1cceb81113179d6d9619
* feat(backend): add endpoint to retrieve single request by ID with full response 5b6a7cc9808ddf140b34bf150ec88958470ede74
* feat(backend): check connection status in logs and requests streams bc290e5ecdf99187c097e207b6e2baacab36a5bf
* feat(backend): enhance user information in request logs with details 61a4370f75f5ac433db48a0d007ea136d9260723
* feat(backend): implement in-memory cache for global settings 0d53fb19eaebc5417d5a50f4afba30fc7d859d81
* fix(backend): add name property to raw setting object in tests 36345bd37be4d210724cd1f64571dfbcdeced937
* refactor(all): update changelog transformation to filter commits a6e71765c1f8ae2c37ae4bb58ce31aa0b11f6eda

## 0.54.0 (2025-12-19)

* feat(all): Add MCP installation settings, request logs API, and SSE streaming 5f44e43c5fa95527676acc3302c1ac8e764cefe5
* feat(backend): add batch toggle tool disabled status endpoint 2b654884f44e75b0abfd1cceb81113179d6d9619
* feat(backend): add endpoint to retrieve single request by ID with full response 5b6a7cc9808ddf140b34bf150ec88958470ede74
* feat(backend): check connection status in logs and requests streams bc290e5ecdf99187c097e207b6e2baacab36a5bf
* feat(backend): enhance user information in request logs with details 61a4370f75f5ac433db48a0d007ea136d9260723
* feat(backend): implement in-memory cache for global settings 0d53fb19eaebc5417d5a50f4afba30fc7d859d81
* fix(backend): add name property to raw setting object in tests 36345bd37be4d210724cd1f64571dfbcdeced937
* refactor(all): update changelog transformation to filter commits a6e71765c1f8ae2c37ae4bb58ce31aa0b11f6eda

## 0.53.0 (2025-12-15)

* fix(backend): correct satellite command event types for MCP deletion operations 0ca6146ade77a35a90f6c631e608dc5aebe799dd
* fix(backend): preserve satellite commands during account deletion 6db38fa06448ffa854b7177e759cab62a1c88e00
* feat(all): add self-service account deletion 9f968f255eacde72b1ed3da56102f1c401a6c4d3
* feat(frontend): add empty state for no available satellites 002268edc688a01f44dca21a31ffccce9957cd77

## 0.53.0 (2025-12-15)

* fix(backend): correct satellite command event types for MCP deletion operations 0ca6146ade77a35a90f6c631e608dc5aebe799dd
* fix(backend): preserve satellite commands during account deletion 6db38fa06448ffa854b7177e759cab62a1c88e00
* fix(backend): properly delete MCP installations and notify satellites during team deletion 6d82fb3582b519cb44b640479fcd15f0d8e6ed21
* fix(frontend): preserve team permissions after update and improve delete modal UX d7e92dbd2418858141c937f54ac5219bee3b496c
* fix(satellite): resolve Docker volume permission issues preventing credential persistence 6aa532f24650a1e009a0be5e5869c295640e436b
* fix(satellite): resolve Docker volume permission issues preventing credential persistence 8d4499a2f8cf9816127ab7bc89af9da5ceb242ed, closes #547
* feat(all): add satellite selection to MCP client configuration 34d1a7972db2b8099825478998fc300058cddaac, closes #548
* feat(all): add satellite_url field with auto-detection and first-heartbeat updates 6ec441c8dfecc96bf7c36c9066f8c2d4a7bd2cf2
* feat(all): add self-service account deletion 9f968f255eacde72b1ed3da56102f1c401a6c4d3
* feat(backend): add satellite_url field to team satellites endpoint af13d14c99fd4b5ae25cd73621720fba942e1b29
* feat(frontend): add empty state for no available satellites 002268edc688a01f44dca21a31ffccce9957cd77

## 0.52.0 (2025-12-12)

* fix(backend): filter disabled servers from regular users, allow global_admin to see all 652696709215ab13de3697722a28e0643cefef76
* fix(frontend): handle validation error in StdioServerInput component 46a685513f2a952e60450fdd3ac5105c45e1f775
* feat(all): add SSE endpoint for streaming MCP client activity 305b0518aa48f072bf9614287323b73dc3bd1dec
* feat(all): add SSE streaming to MCP metrics endpoint a3ce7487c1d55cf750d9cf6de9aa187997bfb781
* feat(all): implement OAuth pending flows to prevent orphaned installations 8e83df53bbe09ca628ef74347fd6d9c7aafb3400
* feat(backend): add SSE plugin with heartbeat interval for server events 9e75a8976ff59da9a0558713ba2a38c168e4d8ac
* feat(frontend): add DsCard component and update action renderers 8d33715c534798b33985c7f5373ece383b01b01f
* feat(frontend): add loading skeletons for satellite table display 5049c9f86d43260413f58bc00f301e3f7ed1abdb
* feat(frontend): add navigation buttons to configuration schema step a869274d40a86149581544bf30d4fdb2c830bf56
* feat(frontend): add team detail components for general, limits, and members 5cd579a3e7e16cd2593e53eedbd170d6480c61e1
* feat(frontend): add utility class for blue links and update usage e5530322bf167315790f7841556211e8a489c919
* feat(frontend): enhance configuration schema steps with navigation buttons 4295c1b65f36d0f62b9ad2a9ed14ef8506344090
* feat(frontend): enhance GitHub App settings with connection test feedback 56bf18b509aebab67a3bd3153a5cafe46d34eec3
* feat(frontend): enhance job details and status display with skeletons 9cfbdaa4ed9b57bc1e4d64a56bdbd9c52bd7d7e8
* feat(frontend): enhance token and satellite status display with icons 00c9f76d1506065476d44ea5da4a93eba1778bf3
* feat(frontend): enhance validation for HTTP server configuration 4c6a684f0e869cb72379682c6aba45c31cf326b9
* feat(frontend): implement admin and team navigation menus 2ed385f85cfab2c161193e93411e1a8ecb050d29
* feat(frontend): implement DsCard component and refactor team management UI ab6b4ca9349cb40c3bd8a6804abcae68b0b472c0
* feat(frontend): implement featured MCP servers list and browsing option bf759aea7b6fda071ecdd2092052f14d0c61aefd
* feat(frontend): implement team edit functionality with validation 81cd1287852554d0e5d25b726ebc757b5b005786
* feat(frontend): implement user detail view with password reset functionality f929ae009b38ba2fa043753381aa2b803c111213
* feat(frontend): implement wizard stepper component for navigation 85c8cd3aded76feffb045be39466ebf4ba9ca49f
* feat(frontend): implement wizard stepper for MCP server configuration 462f4bab4ef0a6b55a4d5f3795b3d161647817a1
* feat(frontend): update account sidebar navigation with settings menu e04ac097b9785f688f3679008b97166b264df5d8
* feat(frontend): update color variables and improve navbar layout e70d25092eb03a80365d7355c0e05ed6e5e3882a
* refactor(frontend): improve SMTP settings UI with toast notifications e26c3354dc3fb51421afa161cafbecba1e5f601b
* refactor(frontend): replace horizontal icon with vertical icon in tables 7e23e220a3a4d552511eb6697d02197008b5f1ef
* refactor(frontend): simplify header structure in multiple components 7c9902ee814c58aae246fc6e417cbb695204d2fb
* style(frontend): update text color for improved visibility in headings d8b33431541c93c2d5f6b816d6dcf82c49b872f7
* style(frontend): update text colors for improved visibility in settings menu 73178874f32b44ba360daadecfec4ab499ce7134
* feat(backend,satellite): add MCP server status lifecycle tracking with health checks, logs, and auto-recovery dd384d0bb4c001a8b72a39319a59fa8f3f7c4449

## 0.52.0 (2025-12-12)

* fix(backend): filter disabled servers from regular users, allow global_admin to see all 652696709215ab13de3697722a28e0643cefef76
* fix(frontend): handle validation error in StdioServerInput component 46a685513f2a952e60450fdd3ac5105c45e1f775
* feat(all): add SSE endpoint for streaming MCP client activity 305b0518aa48f072bf9614287323b73dc3bd1dec
* feat(all): add SSE streaming to MCP metrics endpoint a3ce7487c1d55cf750d9cf6de9aa187997bfb781
* feat(all): implement OAuth pending flows to prevent orphaned installations 8e83df53bbe09ca628ef74347fd6d9c7aafb3400
* feat(backend): add SSE plugin with heartbeat interval for server events 9e75a8976ff59da9a0558713ba2a38c168e4d8ac
* feat(frontend): add DsCard component and update action renderers 8d33715c534798b33985c7f5373ece383b01b01f
* feat(frontend): add loading skeletons for satellite table display 5049c9f86d43260413f58bc00f301e3f7ed1abdb
* feat(frontend): add navigation buttons to configuration schema step a869274d40a86149581544bf30d4fdb2c830bf56
* feat(frontend): add team detail components for general, limits, and members 5cd579a3e7e16cd2593e53eedbd170d6480c61e1
* feat(frontend): add utility class for blue links and update usage e5530322bf167315790f7841556211e8a489c919
* feat(frontend): enhance configuration schema steps with navigation buttons 4295c1b65f36d0f62b9ad2a9ed14ef8506344090
* feat(frontend): enhance GitHub App settings with connection test feedback 56bf18b509aebab67a3bd3153a5cafe46d34eec3
* feat(frontend): enhance job details and status display with skeletons 9cfbdaa4ed9b57bc1e4d64a56bdbd9c52bd7d7e8
* feat(frontend): enhance token and satellite status display with icons 00c9f76d1506065476d44ea5da4a93eba1778bf3
* feat(frontend): enhance validation for HTTP server configuration 4c6a684f0e869cb72379682c6aba45c31cf326b9
* feat(frontend): implement admin and team navigation menus 2ed385f85cfab2c161193e93411e1a8ecb050d29
* feat(frontend): implement DsCard component and refactor team management UI ab6b4ca9349cb40c3bd8a6804abcae68b0b472c0
* feat(frontend): implement featured MCP servers list and browsing option bf759aea7b6fda071ecdd2092052f14d0c61aefd
* feat(frontend): implement team edit functionality with validation 81cd1287852554d0e5d25b726ebc757b5b005786
* feat(frontend): implement user detail view with password reset functionality f929ae009b38ba2fa043753381aa2b803c111213
* feat(frontend): implement wizard stepper component for navigation 85c8cd3aded76feffb045be39466ebf4ba9ca49f
* feat(frontend): implement wizard stepper for MCP server configuration 462f4bab4ef0a6b55a4d5f3795b3d161647817a1
* feat(frontend): update account sidebar navigation with settings menu e04ac097b9785f688f3679008b97166b264df5d8
* feat(frontend): update color variables and improve navbar layout e70d25092eb03a80365d7355c0e05ed6e5e3882a
* refactor(frontend): improve SMTP settings UI with toast notifications e26c3354dc3fb51421afa161cafbecba1e5f601b
* refactor(frontend): replace horizontal icon with vertical icon in tables 7e23e220a3a4d552511eb6697d02197008b5f1ef
* refactor(frontend): simplify header structure in multiple components 7c9902ee814c58aae246fc6e417cbb695204d2fb
* style(frontend): update text color for improved visibility in headings d8b33431541c93c2d5f6b816d6dcf82c49b872f7
* style(frontend): update text colors for improved visibility in settings menu 73178874f32b44ba360daadecfec4ab499ce7134
* feat(backend,satellite): add MCP server status lifecycle tracking with health checks, logs, and auto-recovery dd384d0bb4c001a8b72a39319a59fa8f3f7c4449

## 0.51.0 (2025-12-08)

* feat(frontend): add source filter to MCP server catalog 92afca1b20ce2f63d69a6d1af16a0277c0b63d27
* feat(satellite): add wildcard search for MCP tools and limit results a75e4859bd5dc8cc1d7ab4c0a7f1ffefc00826bd
* chore(all): exclude release commits from changelog e990f583d0744ee15a543d5f3c1628fa382701f6
* chore(deps): update dependencies in package.json and service packages c062e49b1843cbe6ac5223123bcdbecf7702c2c1
* style(frontend): reorder source filter tabs and bulk actions toolbar ee7431120552dc2ec4c86b86826143b5ebfb00af

## 0.51.0 (2025-12-08)

* feat(frontend): add source filter to MCP server catalog 92afca1b20ce2f63d69a6d1af16a0277c0b63d27
* feat(satellite): add wildcard search for MCP tools and limit results a75e4859bd5dc8cc1d7ab4c0a7f1ffefc00826bd
* chore(all): exclude release commits from changelog e990f583d0744ee15a543d5f3c1628fa382701f6
* chore(deps): update dependencies in package.json and service packages c062e49b1843cbe6ac5223123bcdbecf7702c2c1
* style(frontend): reorder source filter tabs and bulk actions toolbar ee7431120552dc2ec4c86b86826143b5ebfb00af

## <small>0.50.2 (2025-12-06)</small>

* chore(backend): release v0.50.2 8b37db4
* chore(satellite): release v0.13.1 50ba696
* chore(satellite): release v0.13.1 45abee8
* fix(backend): clarify backend API base URL description 1f6ef4e
* fix(backend): emit USER_REGISTERED event for new GitHub users 8d84726
* fix(backend): include drizzle migrations in Docker image bc4c9af, closes #546
* fix(backend): update MCP installation email templates for clarity ee9c3bf
* fix(backend): update run-local-postgres script for consistency dda8eb9
* fix(satellite): respect transport_type for SSE MCP servers 96a05fa, closes #553

## <small>0.50.2 (2025-12-06)</small>

* chore(satellite): release v0.13.1 50ba696
* chore(satellite): release v0.13.1 45abee8
* fix(backend): clarify backend API base URL description 1f6ef4e
* fix(backend): emit USER_REGISTERED event for new GitHub users 8d84726
* fix(backend): include drizzle migrations in Docker image bc4c9af, closes #546
* fix(backend): update MCP installation email templates for clarity ee9c3bf
* fix(backend): update run-local-postgres script for consistency dda8eb9
* fix(satellite): respect transport_type for SSE MCP servers 96a05fa, closes #553

## <small>0.50.1 (2025-12-06)</small>

* chore(backend): release v0.50.0 b7e6d19
* chore(backend): release v0.50.0 714a87d
* chore(backend): release v0.50.1 c84b8a3
* chore(frontend): release v0.46.0 016a8c1
* chore(frontend): release v0.46.0 5d8faca
* fix(backend): set default value for DEPLOYSTACK_ENCRYPTION_SECRET 8359fc3
* fix(ci): always pass --increment flag in release PR workflows 6f650be
* feat(backend): add user-level HTTP config overrides for headers and query params 7193e89

## <small>0.50.1 (2025-12-06)</small>

* fix(backend): set default value for DEPLOYSTACK_ENCRYPTION_SECRET 8359fc3
* fix(ci): always pass --increment flag in release PR workflows 6f650be
* chore(backend): release v0.50.0 b7e6d19
* chore(backend): release v0.50.0 714a87d
* chore(frontend): release v0.46.0 016a8c1
* chore(frontend): release v0.46.0 5d8faca
* chore(satellite): release v0.13.0 be96cc1
* chore(satellite): release v0.13.0 fdbbcdf
* feat(all): add real-time MCP server config updates with automatic stdio restart ad287e4
* feat(backend): add user-level HTTP config overrides for headers and query params 7193e89

## 0.50.0 (2025-12-06)

* chore(backend): release v0.50.0 714a87d
* chore(frontend): release v0.46.0 016a8c1
* chore(frontend): release v0.46.0 5d8faca
* fix(backend): set default value for DEPLOYSTACK_ENCRYPTION_SECRET 8359fc3
* feat(backend): add user-level HTTP config overrides for headers and query params 7193e89

## 0.50.0 (2025-12-04)

* chore(backend): release v0.50.0 56decfb
* chore(frontend): release v0.45.0 b3fe4a0
* chore(frontend): release v0.45.0 430bfe1
* feat(all): add user configuration support in installation process cd26a0e
* feat(all): queue MCP server deletion as background job with cascade notifications 679fcb5
* feat(backend): add email notifications for MCP installation events 448e687
* feat(frontend): add boolean select input for environment variables bbd9b62
* feat(frontend): implement server search and installation wizard 4a78930
* feat(frontend): simplify checkbox value update handling in settings 8b7c3ac
* feat(satellite): add support for public backend URL in OAuth configuration aebb814
* fix(backend): notify satellites when auto-installing MCP servers for new teams b3df717
* fix(frontend): clean repository URL and improve validation logic 3862166
* fix(frontend): clear additional edit-related storage keys 726626a
* fix(frontend): implement category caching and loading logic 38fa102
* fix(frontend): normalize tag input to lowercase on addition 50fc847
* fix(frontend): remove hotlined profile picture 2fa3257
* fix(frontend): update logout messages for clarity and consistency 5bf215b
* style(frontend): adjust padding for server details display c19c47a
* docs(all): update feature list with per-tool access controls and catalog improvements d4ec492

## 0.50.0 (2025-12-04)

* feat(all): add user configuration support in installation process cd26a0e
* feat(all): queue MCP server deletion as background job with cascade notifications 679fcb5
* feat(backend): add email notifications for MCP installation events 448e687
* feat(frontend): add boolean select input for environment variables bbd9b62
* feat(frontend): implement server search and installation wizard 4a78930
* feat(frontend): simplify checkbox value update handling in settings 8b7c3ac
* feat(satellite): add support for public backend URL in OAuth configuration aebb814
* fix(backend): notify satellites when auto-installing MCP servers for new teams b3df717
* fix(frontend): clean repository URL and improve validation logic 3862166
* fix(frontend): clear additional edit-related storage keys 726626a
* fix(frontend): implement category caching and loading logic 38fa102
* fix(frontend): normalize tag input to lowercase on addition 50fc847
* fix(frontend): remove hotlined profile picture 2fa3257
* fix(frontend): update logout messages for clarity and consistency 5bf215b
* style(frontend): adjust padding for server details display c19c47a
* chore(frontend): release v0.45.0 b3fe4a0
* chore(frontend): release v0.45.0 430bfe1
* docs(all): update feature list with per-tool access controls and catalog improvements d4ec492

## 0.49.0 (2025-12-01)

* chore(backend): release v0.49.0 cb8ca0a
* chore(satellite): release v0.12.0 f8e0818
* chore(satellite): release v0.12.0 86acd99

## 0.49.0 (2025-12-01)

* chore(frontend): release v0.43.0 7d260ab
* chore(frontend): release v0.43.0 86f1055
* chore(frontend): release v0.44.0 086b98d
* chore(frontend): release v0.44.0 589b69a
* chore(satellite): release v0.12.0 f8e0818
* chore(satellite): release v0.12.0 86acd99
* feat(all): add cleanup job for satellite heartbeats and worker f2f0d7c
* feat(all): add slug field for server identification and validation change a1b8088
* feat(all): implement tool toggle functionality with optimistic updates 4189eb0
* feat(backend): enhance database connection options and error logging 2ac4964
* feat(backend): implement CRUD operations for OAuth providers ddb26bd
* feat(backend): implement toggle tool status route for MCP installations a4f8713
* feat(satellite): enhance logging for tool execution and OAuth header injection 0bd6546
* feat(satellite): implement disabled tool management and filtering 7adc7b4
* feat(satellite): unify tool path format to use serverSlug for namespacing 210a576
* fix(backend): convert string values to numbers for tool statistics 17b970f

## 0.48.0 (2025-11-29)

* chore(backend): release v0.47.0 2070153
* chore(backend): release v0.47.0 cb03508
* chore(backend): release v0.48.0 dde356a
* feat(all): add server_count to MCP category schema and responses, view mcp server catalog 7bac93b
* feat(backend): add API endpoint for retrieving team usage statistics 0be749b
* feat(backend): add API endpoint to list featured MCP categories 79c6a53
* feat(backend): enhance server list and search responses with category details 92a86a1
* feat(backend): implement minimal server response format for list endpoints bf97cd6
* feat(frontend): add featured MCP servers page and related components 00f4897
* feat(frontend): add spinner component and replace loading indicators 8f5bd9f
* feat(frontend): add team usage indicator component and integration e035a86
* feat(frontend): add team usage statistics component and API integration 0befca8
* feat(frontend): implement settings menu components for client configuration 0eb2ae6
* fix(backend): replace like with ilike for case-insensitive search e88c5fb

## 0.48.0 (2025-11-29)

* feat(all): add server_count to MCP category schema and responses, view mcp server catalog 7bac93b
* feat(backend): add API endpoint for retrieving team usage statistics 0be749b
* feat(backend): add API endpoint to list featured MCP categories 79c6a53
* feat(backend): enhance server list and search responses with category details 92a86a1
* feat(backend): implement minimal server response format for list endpoints bf97cd6
* feat(frontend): add featured MCP servers page and related components 00f4897
* feat(frontend): add spinner component and replace loading indicators 8f5bd9f
* feat(frontend): add team usage indicator component and integration e035a86
* feat(frontend): add team usage statistics component and API integration 0befca8
* feat(frontend): implement settings menu components for client configuration 0eb2ae6
* fix(backend): replace like with ilike for case-insensitive search e88c5fb

## 0.47.0 (2025-11-28)

* chore(all): bump isomorphic-dompurify from 2.32.0 to 2.33.0 6243596
* chore(all): update dependencies in package.json files 12bdfcd
* chore(backend): release v0.47.0 cb03508
* chore(deps): bump actions/checkout from 5 to 6 e5d84d1
* chore(frontend): release v0.42.0 94ca47c
* chore(frontend): release v0.42.0 14e3b3b
* feat(all): implement breadcrumbs and several frontend and UI improvements f3d3e70
* feat(backend): add total MCP server installation limit per team a9dff02
* feat(frontend): add MCP server limit to team management forms c47091a
* feat(frontend): replace switches with checkboxes for settings c144d10
* fix(backend): set git_branch to null if repository_url is absent bb16362
* style(frontend): remove max-width from content area in settings and profile b9624a8
* feature(backend): re-build the global settings - added name param dfab0ed

## 0.47.0 (2025-11-28)

* chore(all): bump isomorphic-dompurify from 2.32.0 to 2.33.0 6243596
* chore(all): update dependencies in package.json files 12bdfcd
* chore(deps): bump actions/checkout from 5 to 6 e5d84d1
* chore(frontend): release v0.42.0 94ca47c
* chore(frontend): release v0.42.0 14e3b3b
* feat(all): implement breadcrumbs and several frontend and UI improvements f3d3e70
* feat(backend): add total MCP server installation limit per team a9dff02
* feat(frontend): add MCP server limit to team management forms c47091a
* feat(frontend): replace switches with checkboxes for settings c144d10
* fix(backend): set git_branch to null if repository_url is absent bb16362
* style(frontend): remove max-width from content area in settings and profile b9624a8
* feature(backend): re-build the global settings - added name param dfab0ed

## 0.46.0 (2025-11-25)

* chore(backend): release v0.46.0 1490b2a
* chore(frontend): release v0.41.0 6f71964
* chore(frontend): release v0.41.0 52da4b2
* feat(backend): add satellite command notifications for MCP installations 769d557
* feat(backend): complete PostgreSQL-only database migration 88c52f8
* refactor(backend): use GlobalSettings for backend URL in OAuth routes 7aa72ca
* refactor(satellite): enhance headers for Cloudflare compatibility 362987f

## 0.46.0 (2025-11-25)

* chore(frontend): release v0.41.0 6f71964
* chore(frontend): release v0.41.0 52da4b2
* chore(satellite): release v0.11.0 bfcb1ff
* chore(satellite): release v0.11.0 9fddc8e
* feat(backend): add satellite command notifications for MCP installations 769d557
* feat(backend): complete PostgreSQL-only database migration 88c52f8
* refactor(backend): use GlobalSettings for backend URL in OAuth routes 7aa72ca
* refactor(satellite): enhance headers for Cloudflare compatibility 362987f

## 0.45.0 (2025-11-22)

* chore(all): update dependencies across services 44bbbc2
* chore(backend): release v0.45.0 13a7796
* chore(frontend): release v0.40.0 d422afc
* chore(frontend): release v0.40.0 b5ddad8
* refactor(all): simplify conventional changelog preset configuration 482c662
* feat(all): add OAuth authorization step in server installation wizard fce8128
* feat(all): add README content management to MCP server forms f0b706e
* feat(backend): add endpoint to retrieve available satellites for team 5c87421
* feat(backend): add installation_type field for OAuth installations c79f52a
* feat(backend): add OAuth token management services and utilities 3729357
* feat(backend): added icon_url to mcp catalog a1d66de
* feat(backend): auto-fill icon_url from GitHub avatar if not provided 3f418cf
* feat(backend): implement OAuth token retrieval and status endpoints 51472b6
* feat(backend): implement OAuthDiscoveryService for detecting and discovering OAuth metadata from MCP 424a4bc
* feat(frontend): add icon_url field to MCP server forms and views 7356c2b
* feat(frontend): add satellite selection step in installation wizard f4c71d0
* feat(frontend): add website URL display in MCP server card 703416c
* feat(frontend): add website URL field to MCP server forms 5de8134
* feat(frontend): enhance MCP server details with specifications view 3f08f39
* feat(frontend): make repository URL optional in GitHub step aab785c

## 0.45.0 (2025-11-22)

* chore(all): update dependencies across services 44bbbc2
* chore(frontend): release v0.40.0 b5ddad8
* refactor(all): simplify conventional changelog preset configuration 482c662
* feat(all): add OAuth authorization step in server installation wizard fce8128
* feat(all): add README content management to MCP server forms f0b706e
* feat(backend): add endpoint to retrieve available satellites for team 5c87421
* feat(backend): add installation_type field for OAuth installations c79f52a
* feat(backend): add OAuth token management services and utilities 3729357
* feat(backend): added icon_url to mcp catalog a1d66de
* feat(backend): auto-fill icon_url from GitHub avatar if not provided 3f418cf
* feat(backend): implement OAuth token retrieval and status endpoints 51472b6
* feat(backend): implement OAuthDiscoveryService for detecting and discovering OAuth metadata from MCP 424a4bc
* feat(frontend): add icon_url field to MCP server forms and views 7356c2b
* feat(frontend): add satellite selection step in installation wizard f4c71d0
* feat(frontend): add website URL display in MCP server card 703416c
* feat(frontend): add website URL field to MCP server forms 5de8134
* feat(frontend): enhance MCP server details with specifications view 3f08f39
* feat(frontend): make repository URL optional in GitHub step aab785c

## 0.44.0 (2025-11-17)

* chore(backend): release v0.44.0 ([1c71e34](https://github.com/deploystackio/deploystack/commit/1c71e34))
* chore(frontend): release v0.39.0 ([2245bc8](https://github.com/deploystackio/deploystack/commit/2245bc8))
* chore(frontend): release v0.39.0 ([fd6535a](https://github.com/deploystackio/deploystack/commit/fd6535a))

## 0.44.0 (2025-11-17)

* chore(all): bump @octokit/request from 10.0.6 to 10.0.7 ([ed81e3e](https://github.com/deploystackio/deploystack/commit/ed81e3e))
* chore(all): bump nodemon from 3.1.10 to 3.1.11 ([653ab6e](https://github.com/deploystackio/deploystack/commit/653ab6e))
* chore(frontend): release v0.38.0 ([f11c7df](https://github.com/deploystackio/deploystack/commit/f11c7df))
* chore(frontend): release v0.38.0 ([68958a3](https://github.com/deploystackio/deploystack/commit/68958a3))
* chore(frontend): release v0.39.0 ([2245bc8](https://github.com/deploystackio/deploystack/commit/2245bc8))
* chore(frontend): release v0.39.0 ([fd6535a](https://github.com/deploystackio/deploystack/commit/fd6535a))
* chore(satellite): release v0.10.0 ([5045d3a](https://github.com/deploystackio/deploystack/commit/5045d3a))
* chore(satellite): release v0.10.0 ([0676b8f](https://github.com/deploystackio/deploystack/commit/0676b8f))
* chore(satellite): release v0.9.0 ([ae5ab63](https://github.com/deploystackio/deploystack/commit/ae5ab63))
* chore(satellite): release v0.9.0 ([0c4a7c4](https://github.com/deploystackio/deploystack/commit/0c4a7c4))
* feat(all): add category-specific client configuration API endpoint ([da6a24e](https://github.com/deploystackio/deploystack/commit/da6a24e))
* feat(all): add OAuth 2.1 authentication for MCP servers ([ec98c8b](https://github.com/deploystackio/deploystack/commit/ec98c8b))
* feat(all): implemented token usage statistics ([2fcd9cf](https://github.com/deploystackio/deploystack/commit/2fcd9cf))
* feat(backend): enhance API specifications and add Cursor support ([a214653](https://github.com/deploystackio/deploystack/commit/a214653))
* feat(backend): enhance MCP client types API with categorized response ([21e4833](https://github.com/deploystackio/deploystack/commit/21e4833))
* feat(frontend): add statistics page with under construction message ([1ad3ab7](https://github.com/deploystackio/deploystack/commit/1ad3ab7))
* fix(satellite): update markdown linting path for AI instructions ([8032166](https://github.com/deploystackio/deploystack/commit/8032166))
* fix(satellite): update token consumption metrics in README ([b58e58b](https://github.com/deploystackio/deploystack/commit/b58e58b))
* docs(satellite): update example outputs in token counter utility ([a4de6d1](https://github.com/deploystackio/deploystack/commit/a4de6d1))

## 0.43.0 (2025-11-15)

* chore(all): update dependencies in backend, frontend, and satellite services ([94a274f](https://github.com/deploystackio/deploystack/commit/94a274f))
* chore(backend): release v0.43.0 ([4c730dd](https://github.com/deploystackio/deploystack/commit/4c730dd))
* chore(satellite): release v0.8.0 ([8770637](https://github.com/deploystackio/deploystack/commit/8770637))
* chore(satellite): release v0.8.0 ([109792a](https://github.com/deploystackio/deploystack/commit/109792a))
* feat(all): MCP Tool Metadata Collection & Display ([8af4610](https://github.com/deploystackio/deploystack/commit/8af4610))

## 0.43.0 (2025-11-15)

* feat(all): MCP Tool Metadata Collection & Display ([8af4610](https://github.com/deploystackio/deploystack/commit/8af4610))
* chore(all): update dependencies in backend, frontend, and satellite services ([94a274f](https://github.com/deploystackio/deploystack/commit/94a274f))
* chore(satellite): release v0.8.0 ([8770637](https://github.com/deploystackio/deploystack/commit/8770637))
* chore(satellite): release v0.8.0 ([109792a](https://github.com/deploystackio/deploystack/commit/109792a))

## 0.42.0 (2025-11-11)

* chore(all): bump @octokit/auth-app from 8.1.1 to 8.1.2 ([b9e93c6](https://github.com/deploystackio/deploystack/commit/b9e93c6))
* chore(all): bump @octokit/request from 10.0.5 to 10.0.6 ([67fcd1b](https://github.com/deploystackio/deploystack/commit/67fcd1b))
* chore(all): bump marked from 16.4.1 to 17.0.0 ([aa37cf6](https://github.com/deploystackio/deploystack/commit/aa37cf6))
* chore(all): bump release-it from 19.0.5 to 19.0.6 ([d2fdb5c](https://github.com/deploystackio/deploystack/commit/d2fdb5c))
* chore(backend): release v0.42.0 ([9d96581](https://github.com/deploystackio/deploystack/commit/9d96581))
* chore(frontend): release v0.37.0 ([2e71d44](https://github.com/deploystackio/deploystack/commit/2e71d44))
* chore(frontend): release v0.37.0 ([bfa8025](https://github.com/deploystackio/deploystack/commit/bfa8025))
* feat(all): Add support for URL query parameters in MCP server configuration ([bce275a](https://github.com/deploystackio/deploystack/commit/bce275a))
* feat(all): added new route for MCP client config ([1d7fb4a](https://github.com/deploystackio/deploystack/commit/1d7fb4a))

## 0.42.0 (2025-11-11)

* chore(all): bump @octokit/auth-app from 8.1.1 to 8.1.2 ([b9e93c6](https://github.com/deploystackio/deploystack/commit/b9e93c6))
* chore(all): bump @octokit/request from 10.0.5 to 10.0.6 ([67fcd1b](https://github.com/deploystackio/deploystack/commit/67fcd1b))
* chore(all): bump marked from 16.4.1 to 17.0.0 ([aa37cf6](https://github.com/deploystackio/deploystack/commit/aa37cf6))
* chore(all): bump release-it from 19.0.5 to 19.0.6 ([d2fdb5c](https://github.com/deploystackio/deploystack/commit/d2fdb5c))
* chore(frontend): release v0.37.0 ([2e71d44](https://github.com/deploystackio/deploystack/commit/2e71d44))
* chore(frontend): release v0.37.0 ([bfa8025](https://github.com/deploystackio/deploystack/commit/bfa8025))
* feat(all): Add support for URL query parameters in MCP server configuration ([bce275a](https://github.com/deploystackio/deploystack/commit/bce275a))
* feat(all): added new route for MCP client config ([1d7fb4a](https://github.com/deploystackio/deploystack/commit/1d7fb4a))

## 0.41.0 (2025-11-09)

* chore(all): bump @modelcontextprotocol/sdk from 1.20.2 to 1.21.0 ([7c81126](https://github.com/deploystackio/deploystack/commit/7c81126))
* chore(all): bump @types/node from 24.8.1 to 24.10.0 ([3467f4b](https://github.com/deploystackio/deploystack/commit/3467f4b))
* chore(all): bump @types/uuid from 10.0.0 to 11.0.0 ([5ee2773](https://github.com/deploystackio/deploystack/commit/5ee2773))
* chore(all): bump lucide-vue-next from 0.546.0 to 0.552.0 ([b6058de](https://github.com/deploystackio/deploystack/commit/b6058de))
* chore(all): update node version to 24 in workflow files ([147192d](https://github.com/deploystackio/deploystack/commit/147192d))
* chore(backend): release v0.41.0 ([ddc0084](https://github.com/deploystackio/deploystack/commit/ddc0084))
* chore(backend): update dependencies in package.json ([e3f9c05](https://github.com/deploystackio/deploystack/commit/e3f9c05))
* chore(frontend): bump lucide-vue-next in /services/frontend ([cb55024](https://github.com/deploystackio/deploystack/commit/cb55024))
* chore(frontend): release v0.36.0 ([577fde3](https://github.com/deploystackio/deploystack/commit/577fde3))
* chore(frontend): release v0.36.0 ([347024b](https://github.com/deploystackio/deploystack/commit/347024b))
* chore(frontend): update dependencies in frontend package.json ([4fa9043](https://github.com/deploystackio/deploystack/commit/4fa9043))
* chore(satellite): bump @types/uuid in /services/satellite ([319a8cf](https://github.com/deploystackio/deploystack/commit/319a8cf))
* chore(satellite): bump zod from 3.25.76 to 4.1.12 in /services/satellite ([f6f825d](https://github.com/deploystackio/deploystack/commit/f6f825d))
* feat(all): add teams management functionality for global admins ([d3a9926](https://github.com/deploystackio/deploystack/commit/d3a9926))
* feat(backend): implement admin team update route with validation and response schemas ([09ae873](https://github.com/deploystackio/deploystack/commit/09ae873))

## 0.41.0 (2025-11-09)

* chore(all): bump @modelcontextprotocol/sdk from 1.20.2 to 1.21.0 ([7c81126](https://github.com/deploystackio/deploystack/commit/7c81126))
* chore(all): bump @types/node from 24.8.1 to 24.10.0 ([3467f4b](https://github.com/deploystackio/deploystack/commit/3467f4b))
* chore(all): bump @types/uuid from 10.0.0 to 11.0.0 ([5ee2773](https://github.com/deploystackio/deploystack/commit/5ee2773))
* chore(all): bump lucide-vue-next from 0.546.0 to 0.552.0 ([b6058de](https://github.com/deploystackio/deploystack/commit/b6058de))
* chore(all): update node version to 24 in workflow files ([147192d](https://github.com/deploystackio/deploystack/commit/147192d))
* chore(backend): update dependencies in package.json ([e3f9c05](https://github.com/deploystackio/deploystack/commit/e3f9c05))
* chore(frontend): bump lucide-vue-next in /services/frontend ([cb55024](https://github.com/deploystackio/deploystack/commit/cb55024))
* chore(frontend): release v0.35.0 ([f9bfa86](https://github.com/deploystackio/deploystack/commit/f9bfa86))
* chore(frontend): release v0.35.0 ([37f88a6](https://github.com/deploystackio/deploystack/commit/37f88a6))
* chore(frontend): release v0.36.0 ([347024b](https://github.com/deploystackio/deploystack/commit/347024b))
* chore(frontend): update dependencies in frontend package.json ([4fa9043](https://github.com/deploystackio/deploystack/commit/4fa9043))
* chore(satellite): bump @types/uuid in /services/satellite ([319a8cf](https://github.com/deploystackio/deploystack/commit/319a8cf))
* chore(satellite): bump zod from 3.25.76 to 4.1.12 in /services/satellite ([f6f825d](https://github.com/deploystackio/deploystack/commit/f6f825d))
* feat(all): add teams management functionality for global admins ([d3a9926](https://github.com/deploystackio/deploystack/commit/d3a9926))
* feat(backend): implement admin team update route with validation and response schemas ([09ae873](https://github.com/deploystackio/deploystack/commit/09ae873))

## 0.40.0 (2025-11-04)

* chore(backend): release v0.40.0 ([58435ff](https://github.com/deploystackio/deploystack/commit/58435ff))
* chore(satellite): release v0.7.0 ([3aaf75c](https://github.com/deploystackio/deploystack/commit/3aaf75c))
* chore(satellite): release v0.7.0 ([b94bbbd](https://github.com/deploystackio/deploystack/commit/b94bbbd))
* feat(all): added support for claude code ([6b2e8a7](https://github.com/deploystackio/deploystack/commit/6b2e8a7))
* feat(backend): added mcp server source type ([a9429a6](https://github.com/deploystackio/deploystack/commit/a9429a6))
* feat(backend): resolve plugin path determination for production environment ([bb0f504](https://github.com/deploystackio/deploystack/commit/bb0f504))
* feat(frontend): add source field to MCP server and display in details ([2461f88](https://github.com/deploystackio/deploystack/commit/2461f88))
* feat(satellite): implement hierarchical tool search with Fuse.js ([5545c20](https://github.com/deploystackio/deploystack/commit/5545c20))
* docs(all): update README to clarify management chaos and token reduction ([d5e5000](https://github.com/deploystackio/deploystack/commit/d5e5000))
* docs(all): update README to clarify MCP challenges and solutions ([46ce1e9](https://github.com/deploystackio/deploystack/commit/46ce1e9))
* fix(backend): update welcome email instructions for MCP client setup ([2da79a9](https://github.com/deploystackio/deploystack/commit/2da79a9))

## 0.40.0 (2025-11-04)

* feat(all): added support for claude code ([6b2e8a7](https://github.com/deploystackio/deploystack/commit/6b2e8a7))
* feat(backend): added mcp server source type ([a9429a6](https://github.com/deploystackio/deploystack/commit/a9429a6))
* feat(backend): resolve plugin path determination for production environment ([bb0f504](https://github.com/deploystackio/deploystack/commit/bb0f504))
* feat(frontend): add source field to MCP server and display in details ([2461f88](https://github.com/deploystackio/deploystack/commit/2461f88))
* feat(satellite): implement hierarchical tool search with Fuse.js ([5545c20](https://github.com/deploystackio/deploystack/commit/5545c20))
* chore(all): bump tailwindcss from 4.1.14 to 4.1.15 ([8365aa2](https://github.com/deploystackio/deploystack/commit/8365aa2))
* chore(all): update dependencies across services ([1b1aba7](https://github.com/deploystackio/deploystack/commit/1b1aba7))
* chore(frontend): release v0.34.0 ([f0e29de](https://github.com/deploystackio/deploystack/commit/f0e29de))
* chore(frontend): release v0.34.0 ([fe6aec7](https://github.com/deploystackio/deploystack/commit/fe6aec7))
* chore(satellite): release v0.7.0 ([3aaf75c](https://github.com/deploystackio/deploystack/commit/3aaf75c))
* chore(satellite): release v0.7.0 ([b94bbbd](https://github.com/deploystackio/deploystack/commit/b94bbbd))
* docs(all): update README to clarify management chaos and token reduction ([d5e5000](https://github.com/deploystackio/deploystack/commit/d5e5000))
* docs(all): update README to clarify MCP challenges and solutions ([46ce1e9](https://github.com/deploystackio/deploystack/commit/46ce1e9))
* fix(backend): update welcome email instructions for MCP client setup ([2da79a9](https://github.com/deploystackio/deploystack/commit/2da79a9))

## 0.39.0 (2025-10-25)

* chore(backend): release v0.39.0 ([3c783bb](https://github.com/deploystackio/deploystack/commit/3c783bb))
* chore(deps): bump actions/setup-node from 5 to 6 ([5050cee](https://github.com/deploystackio/deploystack/commit/5050cee))
* chore(frontend): release v0.33.0 ([068f29a](https://github.com/deploystackio/deploystack/commit/068f29a))
* chore(satellite): release v0.6.0 ([764cce4](https://github.com/deploystackio/deploystack/commit/764cce4))
* chore(satellite): release v0.6.0 ([ae2b514](https://github.com/deploystackio/deploystack/commit/ae2b514))
* refactor(satellite): satellite service to integrate MCP SDK and remove custom transport handlers ([ec92ba4](https://github.com/deploystackio/deploystack/commit/ec92ba4))
* refactor(satellite): simplify Dockerfile for development environment ([45e31c7](https://github.com/deploystackio/deploystack/commit/45e31c7))
* feat(satellite): add authentication middleware to MCP routes for stats ([c292d86](https://github.com/deploystackio/deploystack/commit/c292d86))
* feat(satellite): enhance MCP protocol to handle initialized notifications ([9b95a08](https://github.com/deploystackio/deploystack/commit/9b95a08))

## 0.39.0 (2025-10-24)

* chore(deps): bump actions/setup-node from 5 to 6 ([5050cee](https://github.com/deploystackio/deploystack/commit/5050cee))
* chore(frontend): release v0.33.0 ([068f29a](https://github.com/deploystackio/deploystack/commit/068f29a))
* chore(satellite): release v0.6.0 ([764cce4](https://github.com/deploystackio/deploystack/commit/764cce4))
* chore(satellite): release v0.6.0 ([ae2b514](https://github.com/deploystackio/deploystack/commit/ae2b514))
* refactor(satellite): satellite service to integrate MCP SDK and remove custom transport handlers ([ec92ba4](https://github.com/deploystackio/deploystack/commit/ec92ba4))
* refactor(satellite): simplify Dockerfile for development environment ([45e31c7](https://github.com/deploystackio/deploystack/commit/45e31c7))
* feat(satellite): add authentication middleware to MCP routes for stats ([c292d86](https://github.com/deploystackio/deploystack/commit/c292d86))
* feat(satellite): enhance MCP protocol to handle initialized notifications ([9b95a08](https://github.com/deploystackio/deploystack/commit/9b95a08))

## 0.38.0 (2025-10-21)

* chore(backend): release v0.38.0 ([27fd535](https://github.com/deploystackio/deploystack/commit/27fd535))
* chore(satellite): release v0.5.0 ([e8098dd](https://github.com/deploystackio/deploystack/commit/e8098dd))
* chore(satellite): release v0.5.0 ([8a5c148](https://github.com/deploystackio/deploystack/commit/8a5c148))
* feat(all): Add shared types and components for configuration schema management ([231e4f9](https://github.com/deploystackio/deploystack/commit/231e4f9))
* feat(backend): add cleanup old jobs cron and worker functionality ([2f63f81](https://github.com/deploystackio/deploystack/commit/2f63f81))
* feat(frontend): add search button and manual execution for server search ([0fb2c8e](https://github.com/deploystackio/deploystack/commit/0fb2c8e))
* feat(satellite): add uninstall shutdown handling to skip crash detection ([f34fef8](https://github.com/deploystackio/deploystack/commit/f34fef8))
* feat(satellite): enhance debug route to group servers by team ([be24451](https://github.com/deploystackio/deploystack/commit/be24451))
* feat(satellite): enhance nsjail resource limits and cache directory management ([d0e38e1](https://github.com/deploystackio/deploystack/commit/d0e38e1))
* feat(satellite): filter out stdio servers during tool discovery ([b5317e2](https://github.com/deploystackio/deploystack/commit/b5317e2))
* feat(satellite): handle cleanup of removed servers during config changes ([785b73c](https://github.com/deploystackio/deploystack/commit/785b73c))
* feat(satellite): implement server removal handling for active and dormant states ([593a9a7](https://github.com/deploystackio/deploystack/commit/593a9a7))
* feat(satellite): resolve command paths for nsjail execution ([a253bc6](https://github.com/deploystackio/deploystack/commit/a253bc6))
* fix(backend): update redirect URI patterns for Claude.ai MCP OAuth ([22383da](https://github.com/deploystackio/deploystack/commit/22383da))
* fix(frontend): validate remote objects in server configuration ([0f1ee1b](https://github.com/deploystackio/deploystack/commit/0f1ee1b))
* fix(satellite): adjust shutdown notification handling during tool discovery ([1896108](https://github.com/deploystackio/deploystack/commit/1896108))
* fix(satellite): improve error handling for unhandled rejections and exceptions ([8d16c9f](https://github.com/deploystackio/deploystack/commit/8d16c9f))

## 0.38.0 (2025-10-21)

* feat(all): Add shared types and components for configuration schema management ([231e4f9](https://github.com/deploystackio/deploystack/commit/231e4f9))
* feat(backend): add cleanup old jobs cron and worker functionality ([2f63f81](https://github.com/deploystackio/deploystack/commit/2f63f81))
* feat(frontend): add search button and manual execution for server search ([0fb2c8e](https://github.com/deploystackio/deploystack/commit/0fb2c8e))
* feat(satellite): add uninstall shutdown handling to skip crash detection ([f34fef8](https://github.com/deploystackio/deploystack/commit/f34fef8))
* feat(satellite): enhance debug route to group servers by team ([be24451](https://github.com/deploystackio/deploystack/commit/be24451))
* feat(satellite): enhance nsjail resource limits and cache directory management ([d0e38e1](https://github.com/deploystackio/deploystack/commit/d0e38e1))
* feat(satellite): filter out stdio servers during tool discovery ([b5317e2](https://github.com/deploystackio/deploystack/commit/b5317e2))
* feat(satellite): handle cleanup of removed servers during config changes ([785b73c](https://github.com/deploystackio/deploystack/commit/785b73c))
* feat(satellite): implement server removal handling for active and dormant states ([593a9a7](https://github.com/deploystackio/deploystack/commit/593a9a7))
* feat(satellite): resolve command paths for nsjail execution ([a253bc6](https://github.com/deploystackio/deploystack/commit/a253bc6))
* fix(backend): update redirect URI patterns for Claude.ai MCP OAuth ([22383da](https://github.com/deploystackio/deploystack/commit/22383da))
* fix(frontend): validate remote objects in server configuration ([0f1ee1b](https://github.com/deploystackio/deploystack/commit/0f1ee1b))
* fix(satellite): adjust shutdown notification handling during tool discovery ([1896108](https://github.com/deploystackio/deploystack/commit/1896108))
* fix(satellite): improve error handling for unhandled rejections and exceptions ([8d16c9f](https://github.com/deploystackio/deploystack/commit/8d16c9f))
* chore(frontend): release v0.32.0 ([0b61a0a](https://github.com/deploystackio/deploystack/commit/0b61a0a))
* chore(frontend): release v0.32.0 ([873adff](https://github.com/deploystackio/deploystack/commit/873adff))
* chore(frontend): update modules ([1b371f8](https://github.com/deploystackio/deploystack/commit/1b371f8))
* chore(satellite): release v0.5.0 ([e8098dd](https://github.com/deploystackio/deploystack/commit/e8098dd))
* chore(satellite): release v0.5.0 ([8a5c148](https://github.com/deploystackio/deploystack/commit/8a5c148))
* chore(satellite): remove unprivileged user namespace configuration ([1bd5eb4](https://github.com/deploystackio/deploystack/commit/1bd5eb4))

## 0.37.0 (2025-10-18)

* docs(all): update README to clarify adoption friction and data ([c0e3a79](https://github.com/deploystackio/deploystack/commit/c0e3a79))
* docs(all): update README to clarify VS Code settings for DeployStack ([05d5a35](https://github.com/deploystackio/deploystack/commit/05d5a35))
* docs(satellite): update README with idle process management details ([552dca2](https://github.com/deploystackio/deploystack/commit/552dca2))
* chore(all): bump @commitlint/cli from 19.8.1 to 20.1.0 ([9eb3189](https://github.com/deploystackio/deploystack/commit/9eb3189))
* chore(all): bump @octokit/request from 10.0.3 to 10.0.5 ([d93fabf](https://github.com/deploystackio/deploystack/commit/d93fabf))
* chore(all): bump @tailwindcss/postcss from 4.1.13 to 4.1.14 ([fd43779](https://github.com/deploystackio/deploystack/commit/fd43779))
* chore(all): bump drizzle-kit from 0.31.4 to 0.31.5 ([18f93d4](https://github.com/deploystackio/deploystack/commit/18f93d4))
* chore(all): bump drizzle-orm from 0.44.5 to 0.44.6 ([0b92ebf](https://github.com/deploystackio/deploystack/commit/0b92ebf))
* chore(all): bump jest from 30.1.3 to 30.2.0 ([7c70f0a](https://github.com/deploystackio/deploystack/commit/7c70f0a))
* chore(all): bump jiti from 2.6.0 to 2.6.1 ([9051c83](https://github.com/deploystackio/deploystack/commit/9051c83))
* chore(all): bump pino from 9.11.0 to 10.0.0 ([7845a12](https://github.com/deploystackio/deploystack/commit/7845a12))
* chore(all): bump tailwindcss from 4.1.13 to 4.1.14 ([e6e06c3](https://github.com/deploystackio/deploystack/commit/e6e06c3))
* chore(all): bump vue-sonner from 2.0.8 to 2.0.9 ([ad873f0](https://github.com/deploystackio/deploystack/commit/ad873f0))
* chore(all): bump vue-tsc from 3.0.8 to 3.1.1 ([8f93277](https://github.com/deploystackio/deploystack/commit/8f93277))
* chore(all): bump zod-openapi from 5.4.1 to 5.4.2 ([35a5b7f](https://github.com/deploystackio/deploystack/commit/35a5b7f))
* chore(backend): bump @commitlint/cli in /services/backend ([f303c24](https://github.com/deploystackio/deploystack/commit/f303c24))
* chore(backend): release v0.37.0 ([dfe44f0](https://github.com/deploystackio/deploystack/commit/dfe44f0))
* chore(backend): update welcome email template for new users ([756e607](https://github.com/deploystackio/deploystack/commit/756e607))
* chore(frontend): bump @types/marked in /services/frontend ([5f4ddd3](https://github.com/deploystackio/deploystack/commit/5f4ddd3))
* chore(frontend): release v0.31.0 ([7e6b608](https://github.com/deploystackio/deploystack/commit/7e6b608))
* chore(frontend): release v0.31.0 ([6c626f8](https://github.com/deploystackio/deploystack/commit/6c626f8))
* chore(frontend): remove unused @types/marked dependency from package.json ([44f88ad](https://github.com/deploystackio/deploystack/commit/44f88ad))
* chore(satellite): remove unnecessary log statements from server startup ([a1ff115](https://github.com/deploystackio/deploystack/commit/a1ff115))
* feat(all): implement idle process management for MCP servers ([e142784](https://github.com/deploystackio/deploystack/commit/e142784))
* feat(all): MCP Client Activity Tracking ([01a130e](https://github.com/deploystackio/deploystack/commit/01a130e))
* feat(backend): add endpoints for retrieving unique languages and runtimes ([f270dc0](https://github.com/deploystackio/deploystack/commit/f270dc0))
* feat(backend): Add MCP client activity metrics cleanup job and worker ([7e1789b](https://github.com/deploystackio/deploystack/commit/7e1789b))
* feat(backend): add MCP client activity metrics endpoint and service ([c02f022](https://github.com/deploystackio/deploystack/commit/c02f022))
* feat(backend): add tags filtering to MCP servers API and implement endpoint to retrieve unique tags ([45f7088](https://github.com/deploystackio/deploystack/commit/45f7088))
* feat(backend): enhance bucket filling with default metric fields ([7009ab2](https://github.com/deploystackio/deploystack/commit/7009ab2))
* feat(backend): enhance MCP client activity endpoint for team awareness ([7ab668c](https://github.com/deploystackio/deploystack/commit/7ab668c))
* feat(backend): implement cron job system for scheduled tasks ([722811a](https://github.com/deploystackio/deploystack/commit/722811a))
* feat(backend): implement satellite event handling and processing ([dcfc9aa](https://github.com/deploystackio/deploystack/commit/dcfc9aa))
* feat(frontend): add API methods to fetch unique runtimes and languages ([2a7f432](https://github.com/deploystackio/deploystack/commit/2a7f432))
* feat(frontend): add chart components with echarts integration ([dc55c62](https://github.com/deploystackio/deploystack/commit/dc55c62))
* feat(frontend): add field components with props and templates ([9ea64be](https://github.com/deploystackio/deploystack/commit/9ea64be))
* feat(frontend): add hover card for Python MCP server installation warning ([df0d271](https://github.com/deploystackio/deploystack/commit/df0d271))
* feat(frontend): add McpClientConnectionsCard component ([7f95f3e](https://github.com/deploystackio/deploystack/commit/7f95f3e))
* feat(frontend): add runtime and tags display to MCP server card ([3b22e37](https://github.com/deploystackio/deploystack/commit/3b22e37))
* feat(frontend): add search and filter functionality to server catalog ([13da4a1](https://github.com/deploystackio/deploystack/commit/13da4a1))
* feat(frontend): add skeleton loading state for MCP server selection ([2653bb4](https://github.com/deploystackio/deploystack/commit/2653bb4))
* feat(frontend): add white variant to card component styles ([755d175](https://github.com/deploystackio/deploystack/commit/755d175))
* feat(frontend): enhance MCP server card with GitHub avatar display ([7479c5e](https://github.com/deploystackio/deploystack/commit/7479c5e))
* feat(frontend): enhance MCP server installation views and add stats component ([6635348](https://github.com/deploystackio/deploystack/commit/6635348))
* feat(frontend): implement ButtonGroup component with variants ([23a0418](https://github.com/deploystackio/deploystack/commit/23a0418))
* feat(frontend): implement client activity tracking and polling ([e73e4e2](https://github.com/deploystackio/deploystack/commit/e73e4e2))
* feat(frontend): implement item components with variants and slots ([3125aa4](https://github.com/deploystackio/deploystack/commit/3125aa4))
* feat(frontend): implement McpInstallationsEmptyState component ([044c3e1](https://github.com/deploystackio/deploystack/commit/044c3e1))
* feat(frontend): integrate team selection for client activity fetching ([bdb2280](https://github.com/deploystackio/deploystack/commit/bdb2280))
* feat(metrics): add MCP client activity metrics endpoint and service ([9b82d78](https://github.com/deploystackio/deploystack/commit/9b82d78))
* feat(satellite): add logger support to event handler functions ([4934a4f](https://github.com/deploystackio/deploystack/commit/4934a4f))
* feat(satellite): implement job management system with heartbeat job ([ef0d19b](https://github.com/deploystackio/deploystack/commit/ef0d19b))
* refactor: clean up code structure and remove redundant sections ([4025c22](https://github.com/deploystackio/deploystack/commit/4025c22))
* refactor(all): update MCP event schemas for consistency and clarity ([2258555](https://github.com/deploystackio/deploystack/commit/2258555))
* refactor(frontend): simplify McpInstallationsCard component structure ([3fdb93d](https://github.com/deploystackio/deploystack/commit/3fdb93d))
* refactor(satellite): improve client name detection logic in headers ([7c48a4a](https://github.com/deploystackio/deploystack/commit/7c48a4a))
* style(frontend): changed style for several views ([f856c52](https://github.com/deploystackio/deploystack/commit/f856c52))

## 0.37.0 (2025-10-17)

* feat(all): Enhanced Job Queue Management - Search & Filtering ([6517f1e](https://github.com/deploystackio/deploystack/commit/6517f1e))
* feat(all): implement idle process management for MCP servers ([e142784](https://github.com/deploystackio/deploystack/commit/e142784))
* feat(all): MCP Client Activity Tracking ([01a130e](https://github.com/deploystackio/deploystack/commit/01a130e))
* feat(backend): add endpoints for retrieving unique languages and runtimes ([f270dc0](https://github.com/deploystackio/deploystack/commit/f270dc0))
* feat(backend): Add MCP client activity metrics cleanup job and worker ([7e1789b](https://github.com/deploystackio/deploystack/commit/7e1789b))
* feat(backend): add MCP client activity metrics endpoint and service ([c02f022](https://github.com/deploystackio/deploystack/commit/c02f022))
* feat(backend): add tags filtering to MCP servers API and implement endpoint to retrieve unique tags ([45f7088](https://github.com/deploystackio/deploystack/commit/45f7088))
* feat(backend): enhance bucket filling with default metric fields ([7009ab2](https://github.com/deploystackio/deploystack/commit/7009ab2))
* feat(backend): enhance MCP client activity endpoint for team awareness ([7ab668c](https://github.com/deploystackio/deploystack/commit/7ab668c))
* feat(backend): implement cron job system for scheduled tasks ([722811a](https://github.com/deploystackio/deploystack/commit/722811a))
* feat(backend): implement satellite event handling and processing ([dcfc9aa](https://github.com/deploystackio/deploystack/commit/dcfc9aa))
* feat(frontend): add API methods to fetch unique runtimes and languages ([2a7f432](https://github.com/deploystackio/deploystack/commit/2a7f432))
* feat(frontend): add chart components with echarts integration ([dc55c62](https://github.com/deploystackio/deploystack/commit/dc55c62))
* feat(frontend): add field components with props and templates ([9ea64be](https://github.com/deploystackio/deploystack/commit/9ea64be))
* feat(frontend): add hover card for Python MCP server installation warning ([df0d271](https://github.com/deploystackio/deploystack/commit/df0d271))
* feat(frontend): add McpClientConnectionsCard component ([7f95f3e](https://github.com/deploystackio/deploystack/commit/7f95f3e))
* feat(frontend): add runtime and tags display to MCP server card ([3b22e37](https://github.com/deploystackio/deploystack/commit/3b22e37))
* feat(frontend): add search and filter functionality to server catalog ([13da4a1](https://github.com/deploystackio/deploystack/commit/13da4a1))
* feat(frontend): add skeleton loading state for MCP server selection ([2653bb4](https://github.com/deploystackio/deploystack/commit/2653bb4))
* feat(frontend): add white variant to card component styles ([755d175](https://github.com/deploystackio/deploystack/commit/755d175))
* feat(frontend): enhance MCP server card with GitHub avatar display ([7479c5e](https://github.com/deploystackio/deploystack/commit/7479c5e))
* feat(frontend): enhance MCP server installation views and add stats component ([6635348](https://github.com/deploystackio/deploystack/commit/6635348))
* feat(frontend): implement ButtonGroup component with variants ([23a0418](https://github.com/deploystackio/deploystack/commit/23a0418))
* feat(frontend): implement client activity tracking and polling ([e73e4e2](https://github.com/deploystackio/deploystack/commit/e73e4e2))
* feat(frontend): implement item components with variants and slots ([3125aa4](https://github.com/deploystackio/deploystack/commit/3125aa4))
* feat(frontend): implement McpInstallationsEmptyState component ([044c3e1](https://github.com/deploystackio/deploystack/commit/044c3e1))
* feat(frontend): integrate team selection for client activity fetching ([bdb2280](https://github.com/deploystackio/deploystack/commit/bdb2280))
* feat(metrics): add MCP client activity metrics endpoint and service ([9b82d78](https://github.com/deploystackio/deploystack/commit/9b82d78))
* feat(satellite): add logger support to event handler functions ([4934a4f](https://github.com/deploystackio/deploystack/commit/4934a4f))
* feat(satellite): implement job management system with heartbeat job ([ef0d19b](https://github.com/deploystackio/deploystack/commit/ef0d19b))
* chore(all): bump @commitlint/cli from 19.8.1 to 20.1.0 ([9eb3189](https://github.com/deploystackio/deploystack/commit/9eb3189))
* chore(all): bump @octokit/request from 10.0.3 to 10.0.5 ([d93fabf](https://github.com/deploystackio/deploystack/commit/d93fabf))
* chore(all): bump @tailwindcss/postcss from 4.1.13 to 4.1.14 ([fd43779](https://github.com/deploystackio/deploystack/commit/fd43779))
* chore(all): bump drizzle-kit from 0.31.4 to 0.31.5 ([18f93d4](https://github.com/deploystackio/deploystack/commit/18f93d4))
* chore(all): bump drizzle-orm from 0.44.5 to 0.44.6 ([0b92ebf](https://github.com/deploystackio/deploystack/commit/0b92ebf))
* chore(all): bump jest from 30.1.3 to 30.2.0 ([7c70f0a](https://github.com/deploystackio/deploystack/commit/7c70f0a))
* chore(all): bump jiti from 2.6.0 to 2.6.1 ([9051c83](https://github.com/deploystackio/deploystack/commit/9051c83))
* chore(all): bump pino from 9.11.0 to 10.0.0 ([7845a12](https://github.com/deploystackio/deploystack/commit/7845a12))
* chore(all): bump tailwindcss from 4.1.13 to 4.1.14 ([e6e06c3](https://github.com/deploystackio/deploystack/commit/e6e06c3))
* chore(all): bump vue-sonner from 2.0.8 to 2.0.9 ([ad873f0](https://github.com/deploystackio/deploystack/commit/ad873f0))
* chore(all): bump vue-tsc from 3.0.8 to 3.1.1 ([8f93277](https://github.com/deploystackio/deploystack/commit/8f93277))
* chore(all): bump zod-openapi from 5.4.1 to 5.4.2 ([35a5b7f](https://github.com/deploystackio/deploystack/commit/35a5b7f))
* chore(backend): bump @commitlint/cli in /services/backend ([f303c24](https://github.com/deploystackio/deploystack/commit/f303c24))
* chore(backend): update welcome email template for new users ([756e607](https://github.com/deploystackio/deploystack/commit/756e607))
* chore(frontend): bump @types/marked in /services/frontend ([5f4ddd3](https://github.com/deploystackio/deploystack/commit/5f4ddd3))
* chore(frontend): release v0.31.0 ([7e6b608](https://github.com/deploystackio/deploystack/commit/7e6b608))
* chore(frontend): release v0.31.0 ([6c626f8](https://github.com/deploystackio/deploystack/commit/6c626f8))
* chore(frontend): remove unused @types/marked dependency from package.json ([44f88ad](https://github.com/deploystackio/deploystack/commit/44f88ad))
* chore(satellite): release v0.4.1 ([5ebb468](https://github.com/deploystackio/deploystack/commit/5ebb468))
* chore(satellite): release v0.4.1 ([6594669](https://github.com/deploystackio/deploystack/commit/6594669))
* chore(satellite): remove unnecessary log statements from server startup ([a1ff115](https://github.com/deploystackio/deploystack/commit/a1ff115))
* refactor: clean up code structure and remove redundant sections ([4025c22](https://github.com/deploystackio/deploystack/commit/4025c22))
* refactor(all): update MCP event schemas for consistency and clarity ([2258555](https://github.com/deploystackio/deploystack/commit/2258555))
* refactor(frontend): simplify McpInstallationsCard component structure ([3fdb93d](https://github.com/deploystackio/deploystack/commit/3fdb93d))
* refactor(satellite): improve client name detection logic in headers ([7c48a4a](https://github.com/deploystackio/deploystack/commit/7c48a4a))
* docs(all): update README to clarify adoption friction and data ([c0e3a79](https://github.com/deploystackio/deploystack/commit/c0e3a79))
* docs(all): update README to clarify VS Code settings for DeployStack ([05d5a35](https://github.com/deploystackio/deploystack/commit/05d5a35))
* style(frontend): changed style for several views ([f856c52](https://github.com/deploystackio/deploystack/commit/f856c52))

## 0.36.0 (2025-10-06)

* chore(backend): release v0.36.0 ([6bdfbcf](https://github.com/deploystackio/deploystack/commit/6bdfbcf))
* chore(satellite): release v0.4.0 ([666b992](https://github.com/deploystackio/deploystack/commit/666b992))
* chore(satellite): release v0.4.0 ([42091ab](https://github.com/deploystackio/deploystack/commit/42091ab))

## 0.36.0 (2025-10-06)

* chore(all): update dependencies and improve package configurations ([a9ed054](https://github.com/deploystackio/deploystack/commit/a9ed054))
* chore(backend): bump @commitlint/config-conventional ([3103017](https://github.com/deploystackio/deploystack/commit/3103017))
* chore(frontend): bump @commitlint/config-conventional ([e7f6b2a](https://github.com/deploystackio/deploystack/commit/e7f6b2a))
* chore(frontend): release v0.30.0 ([8892816](https://github.com/deploystackio/deploystack/commit/8892816))
* chore(frontend): release v0.30.0 ([fc139ea](https://github.com/deploystackio/deploystack/commit/fc139ea))
* chore(satellite): release v0.4.0 ([666b992](https://github.com/deploystackio/deploystack/commit/666b992))
* chore(satellite): release v0.4.0 ([42091ab](https://github.com/deploystackio/deploystack/commit/42091ab))
* feat(all): migrated installation_methods to official mcp registry standard ([5d53296](https://github.com/deploystackio/deploystack/commit/5d53296))
* feat(backend): add MCP Registry sync endpoint and worker ([777520c](https://github.com/deploystackio/deploystack/commit/777520c))
* feat(backend): add MCP Registry sync management endpoints and logic ([7aa9043](https://github.com/deploystackio/deploystack/commit/7aa9043))
* feat(backend): add MCP Registry sync progress and management endpoints ([023c005](https://github.com/deploystackio/deploystack/commit/023c005))
* feat(backend): add optional namespace filtering for server data ([fbf9a9c](https://github.com/deploystackio/deploystack/commit/fbf9a9c))
* feat(backend): add sorting functionality for mcp server search results ([119dd1e](https://github.com/deploystackio/deploystack/commit/119dd1e))
* feat(backend): add utility to convert empty strings to undefined for mcp registry sync ([dfd2c87](https://github.com/deploystackio/deploystack/commit/dfd2c87))
* feat(backend): enhance pagination handling and logging for registry sync ([0810950](https://github.com/deploystackio/deploystack/commit/0810950))
* feat(backend): increase maximum rate limit delay to 120 seconds ([19afec7](https://github.com/deploystackio/deploystack/commit/19afec7))
* feat(frontend): add sorting by GitHub stars to server search ([838c0e5](https://github.com/deploystackio/deploystack/commit/838c0e5))
* feat(frontend): implement pagination controls and enhance search results ([5206466](https://github.com/deploystackio/deploystack/commit/5206466))
* feat(frontend): implement sync form with configurable options ([8bdccc7](https://github.com/deploystackio/deploystack/commit/8bdccc7))
* feat(frontend): update repository info endpoint to use GitHub API ([3e761a3](https://github.com/deploystackio/deploystack/commit/3e761a3))
* feat(satellite): add debug endpoint for comprehensive MCP server info ([55fc834](https://github.com/deploystackio/deploystack/commit/55fc834))
* feat(satellite): implement heartbeat data builder for normalized metrics ([5f67f93](https://github.com/deploystackio/deploystack/commit/5f67f93))
* feat(satellite): Implement runtime state management for MCP server processes ([05b8aff](https://github.com/deploystackio/deploystack/commit/05b8aff))
* feat(satellite): implement unified tool discovery manager for stdio and remote mcp ([db3e4eb](https://github.com/deploystackio/deploystack/commit/db3e4eb))
* refactor(backend): remove deprecated GitHub sync endpoint from API spec ([e530a17](https://github.com/deploystackio/deploystack/commit/e530a17))
* refactor(backend): simplify database client registration logic ([6aaac17](https://github.com/deploystackio/deploystack/commit/6aaac17))
* refactor(backend): simplify header mapping logic for three-tier system ([9370072](https://github.com/deploystackio/deploystack/commit/9370072))

## 0.35.0 (2025-09-29)

* chore(all): bump @typescript-eslint/eslint-plugin from 8.42.0 to 8.44.1 ([cc00afd](https://github.com/deploystackio/deploystack/commit/cc00afd))
* chore(all): bump @typescript-eslint/parser from 8.42.0 to 8.44.1 ([e23164f](https://github.com/deploystackio/deploystack/commit/e23164f))
* chore(all): bump better-sqlite3 from 12.2.0 to 12.3.0 ([f1988fd](https://github.com/deploystackio/deploystack/commit/f1988fd))
* chore(all): bump eslint-plugin-vue from 10.4.0 to 10.5.0 ([6e40ab5](https://github.com/deploystackio/deploystack/commit/6e40ab5))
* chore(all): bump fs-extra from 11.3.1 to 11.3.2 ([5a4a55a](https://github.com/deploystackio/deploystack/commit/5a4a55a))
* chore(all): bump jiti from 2.5.1 to 2.6.0 ([03316dd](https://github.com/deploystackio/deploystack/commit/03316dd))
* chore(all): bump vue-tsc from 3.0.7 to 3.0.8 ([9db75b4](https://github.com/deploystackio/deploystack/commit/9db75b4))
* chore(all): update dependencies in backend, frontend, and satellite services ([931221a](https://github.com/deploystackio/deploystack/commit/931221a))
* chore(backend): release v0.35.0 ([12b8da1](https://github.com/deploystackio/deploystack/commit/12b8da1))
* chore(frontend): release v0.29.0 ([d107ef8](https://github.com/deploystackio/deploystack/commit/d107ef8))
* chore(frontend): release v0.29.0 ([7c7c18d](https://github.com/deploystackio/deploystack/commit/7c7c18d))
* feat(all): added fifo-queue and mcp-readme integration ([06906c6](https://github.com/deploystackio/deploystack/commit/06906c6))
* feat(backend): add github_account_id to API specifications ([e7eee4f](https://github.com/deploystackio/deploystack/commit/e7eee4f))
* feat(backend): added github_account_id ([cb8ba0f](https://github.com/deploystackio/deploystack/commit/cb8ba0f))
* feat(frontend): add GitHub avatar support for MCP servers ([3f6a4fe](https://github.com/deploystackio/deploystack/commit/3f6a4fe))
* refactor(all): update ESLint configuration and TypeScript exclusions ([81e5828](https://github.com/deploystackio/deploystack/commit/81e5828))
* refactor(backend): changed mcp route to OpenAPI spec ([8714830](https://github.com/deploystackio/deploystack/commit/8714830))
* refactor(backend): removed unwanted vars from mcp table ([2d13921](https://github.com/deploystackio/deploystack/commit/2d13921))
* refactor(frontend): remove runtime_min_version from MCP forms and views ([3ae3fed](https://github.com/deploystackio/deploystack/commit/3ae3fed))

## 0.35.0 (2025-09-29)

* chore(all): bump @typescript-eslint/eslint-plugin from 8.42.0 to 8.44.1 ([cc00afd](https://github.com/deploystackio/deploystack/commit/cc00afd))
* chore(all): bump @typescript-eslint/parser from 8.42.0 to 8.44.1 ([e23164f](https://github.com/deploystackio/deploystack/commit/e23164f))
* chore(all): bump better-sqlite3 from 12.2.0 to 12.3.0 ([f1988fd](https://github.com/deploystackio/deploystack/commit/f1988fd))
* chore(all): bump eslint-plugin-vue from 10.4.0 to 10.5.0 ([6e40ab5](https://github.com/deploystackio/deploystack/commit/6e40ab5))
* chore(all): bump fastify from 5.5.0 to 5.6.1 ([f4b9683](https://github.com/deploystackio/deploystack/commit/f4b9683))
* chore(all): bump fs-extra from 11.3.1 to 11.3.2 ([5a4a55a](https://github.com/deploystackio/deploystack/commit/5a4a55a))
* chore(all): bump jiti from 2.5.1 to 2.6.0 ([03316dd](https://github.com/deploystackio/deploystack/commit/03316dd))
* chore(all): bump nanoid from 5.1.5 to 5.1.6 ([0bcd969](https://github.com/deploystackio/deploystack/commit/0bcd969))
* chore(all): bump release-it from 19.0.4 to 19.0.5 ([17c302e](https://github.com/deploystackio/deploystack/commit/17c302e))
* chore(all): bump vue-tsc from 3.0.7 to 3.0.8 ([9db75b4](https://github.com/deploystackio/deploystack/commit/9db75b4))
* chore(all): update dependencies in backend, frontend, and satellite services ([931221a](https://github.com/deploystackio/deploystack/commit/931221a))
* chore(frontend): release v0.28.0 ([aeb8b7a](https://github.com/deploystackio/deploystack/commit/aeb8b7a))
* chore(frontend): release v0.28.0 ([92d741e](https://github.com/deploystackio/deploystack/commit/92d741e))
* chore(frontend): release v0.29.0 ([d107ef8](https://github.com/deploystackio/deploystack/commit/d107ef8))
* chore(frontend): release v0.29.0 ([7c7c18d](https://github.com/deploystackio/deploystack/commit/7c7c18d))
* chore(satellite): release v0.3.0 ([361eaef](https://github.com/deploystackio/deploystack/commit/361eaef))
* chore(satellite): release v0.3.0 ([e256e3f](https://github.com/deploystackio/deploystack/commit/e256e3f))
* feat(all): added fifo-queue and mcp-readme integration ([06906c6](https://github.com/deploystackio/deploystack/commit/06906c6))
* feat(backend): add github_account_id to API specifications ([e7eee4f](https://github.com/deploystackio/deploystack/commit/e7eee4f))
* feat(backend): added github_account_id ([cb8ba0f](https://github.com/deploystackio/deploystack/commit/cb8ba0f))
* feat(frontend): add GitHub avatar support for MCP servers ([3f6a4fe](https://github.com/deploystackio/deploystack/commit/3f6a4fe))
* refactor(all): update ESLint configuration and TypeScript exclusions ([81e5828](https://github.com/deploystackio/deploystack/commit/81e5828))
* refactor(backend): changed mcp route to OpenAPI spec ([8714830](https://github.com/deploystackio/deploystack/commit/8714830))
* refactor(backend): removed unwanted vars from mcp table ([2d13921](https://github.com/deploystackio/deploystack/commit/2d13921))
* refactor(frontend): remove runtime_min_version from MCP forms and views ([3ae3fed](https://github.com/deploystackio/deploystack/commit/3ae3fed))

## 0.34.0 (2025-09-23)

* chore(all): bump @types/node from 20.19.13 to 24.4.0 ([da2047d](https://github.com/deploystackio/deploystack/commit/da2047d))
* chore(all): bump eslint from 9.34.0 to 9.35.0 ([ee720b5](https://github.com/deploystackio/deploystack/commit/ee720b5))
* chore(all): bump pino from 9.9.0 to 9.9.5 ([7d69829](https://github.com/deploystackio/deploystack/commit/7d69829))
* chore(all): bump vite from 7.1.4 to 7.1.5 ([95574fc](https://github.com/deploystackio/deploystack/commit/95574fc))
* chore(all): bump vite from 7.1.6 to 7.1.7 ([f662458](https://github.com/deploystackio/deploystack/commit/f662458))
* chore(all): ci/cd updates ([b32b782](https://github.com/deploystackio/deploystack/commit/b32b782))
* chore(backend): release v0.34.0 ([a7d6771](https://github.com/deploystackio/deploystack/commit/a7d6771))
* feat: Implement satellite registration token management system ([1928400](https://github.com/deploystackio/deploystack/commit/1928400))
* feat(all): added satellite pairing system ([59e63bc](https://github.com/deploystackio/deploystack/commit/59e63bc))
* refactor(backend): improve token cleanup service logging and initialization ([73de288](https://github.com/deploystackio/deploystack/commit/73de288))
* refactor(backend): simplify deleteInstallation logging and remove checks ([cfa74ab](https://github.com/deploystackio/deploystack/commit/cfa74ab))
* refactor(frontend): remove MCP catalog contribution banner component ([4e7c699](https://github.com/deploystackio/deploystack/commit/4e7c699))
* fix(backend): handle property name differences in delete operation ([1444a10](https://github.com/deploystackio/deploystack/commit/1444a10))



## <small>v0.33.1 (2025-09-15)</small>

* chore(all): bump @eslint/js from 9.34.0 to 9.35.0 ([c7d6995](https://github.com/deploystackio/deploystack/commit/c7d6995))
* chore(all): bump @fastify/http-proxy from 10.0.2 to 11.3.0 ([a0664e2](https://github.com/deploystackio/deploystack/commit/a0664e2))
* chore(all): bump @libsql/client from 0.15.14 to 0.15.15 ([f950974](https://github.com/deploystackio/deploystack/commit/f950974))
* chore(all): bump nanoid from 3.3.11 to 5.1.5 ([e07ef11](https://github.com/deploystackio/deploystack/commit/e07ef11))
* chore(all): bump tailwindcss from 4.1.12 to 4.1.13 ([308fa44](https://github.com/deploystackio/deploystack/commit/308fa44))
* chore(all): bump vue from 3.5.20 to 3.5.21 ([43dfe73](https://github.com/deploystackio/deploystack/commit/43dfe73))
* chore(all): bump vue-tsc from 3.0.6 to 3.0.7 ([7d6c7c7](https://github.com/deploystackio/deploystack/commit/7d6c7c7))
* chore(all): bump zod-openapi from 5.4.0 to 5.4.1 ([d0a2d5f](https://github.com/deploystackio/deploystack/commit/d0a2d5f))
* chore(backend): release v0.33.1 ([c5db135](https://github.com/deploystackio/deploystack/commit/c5db135))
* chore(backend): release v0.33.1 ([8ad733e](https://github.com/deploystackio/deploystack/commit/8ad733e))
* chore(deps): bump actions/github-script from 7 to 8 ([1226ad1](https://github.com/deploystackio/deploystack/commit/1226ad1))
* chore(deps): bump actions/setup-node from 4 to 5 ([2c52ca0](https://github.com/deploystackio/deploystack/commit/2c52ca0))
* chore(frontend): bump lucide-vue-next in /services/frontend ([e6010f3](https://github.com/deploystackio/deploystack/commit/e6010f3))
* chore(satellite): bump @fastify/http-proxy in /services/satellite ([3ab8436](https://github.com/deploystackio/deploystack/commit/3ab8436))
* chore(satellite): bump @types/node in /services/satellite ([e50b404](https://github.com/deploystackio/deploystack/commit/e50b404))
* chore(satellite): bump dotenv in /services/satellite ([5cb8a83](https://github.com/deploystackio/deploystack/commit/5cb8a83))

## 0.34.0 (2025-09-23)

* feat: Implement satellite registration token management system ([1928400](https://github.com/deploystackio/deploystack/commit/1928400))
* feat(all): added satellite pairing system ([59e63bc](https://github.com/deploystackio/deploystack/commit/59e63bc))
* refactor(backend): improve token cleanup service logging and initialization ([73de288](https://github.com/deploystackio/deploystack/commit/73de288))
* refactor(backend): simplify deleteInstallation logging and remove checks ([cfa74ab](https://github.com/deploystackio/deploystack/commit/cfa74ab))
* refactor(frontend): remove MCP catalog contribution banner component ([4e7c699](https://github.com/deploystackio/deploystack/commit/4e7c699))
* chore(all): bump @eslint/js from 9.34.0 to 9.35.0 ([c7d6995](https://github.com/deploystackio/deploystack/commit/c7d6995))
* chore(all): bump @fastify/http-proxy from 10.0.2 to 11.3.0 ([a0664e2](https://github.com/deploystackio/deploystack/commit/a0664e2))
* chore(all): bump @libsql/client from 0.15.14 to 0.15.15 ([f950974](https://github.com/deploystackio/deploystack/commit/f950974))
* chore(all): bump @types/node from 20.19.13 to 24.4.0 ([da2047d](https://github.com/deploystackio/deploystack/commit/da2047d))
* chore(all): bump eslint from 9.34.0 to 9.35.0 ([ee720b5](https://github.com/deploystackio/deploystack/commit/ee720b5))
* chore(all): bump nanoid from 3.3.11 to 5.1.5 ([e07ef11](https://github.com/deploystackio/deploystack/commit/e07ef11))
* chore(all): bump pino from 9.9.0 to 9.9.5 ([7d69829](https://github.com/deploystackio/deploystack/commit/7d69829))
* chore(all): bump tailwindcss from 4.1.12 to 4.1.13 ([308fa44](https://github.com/deploystackio/deploystack/commit/308fa44))
* chore(all): bump vite from 7.1.4 to 7.1.5 ([95574fc](https://github.com/deploystackio/deploystack/commit/95574fc))
* chore(all): bump vite from 7.1.6 to 7.1.7 ([f662458](https://github.com/deploystackio/deploystack/commit/f662458))
* chore(all): bump vue from 3.5.20 to 3.5.21 ([43dfe73](https://github.com/deploystackio/deploystack/commit/43dfe73))
* chore(all): bump vue-tsc from 3.0.6 to 3.0.7 ([7d6c7c7](https://github.com/deploystackio/deploystack/commit/7d6c7c7))
* chore(all): bump zod-openapi from 5.4.0 to 5.4.1 ([d0a2d5f](https://github.com/deploystackio/deploystack/commit/d0a2d5f))
* chore(all): ci/cd updates ([b32b782](https://github.com/deploystackio/deploystack/commit/b32b782))
* chore(deps): bump actions/github-script from 7 to 8 ([1226ad1](https://github.com/deploystackio/deploystack/commit/1226ad1))
* chore(deps): bump actions/setup-node from 4 to 5 ([2c52ca0](https://github.com/deploystackio/deploystack/commit/2c52ca0))
* chore(frontend): bump lucide-vue-next in /services/frontend ([e6010f3](https://github.com/deploystackio/deploystack/commit/e6010f3))
* chore(satellite): bump @fastify/http-proxy in /services/satellite ([3ab8436](https://github.com/deploystackio/deploystack/commit/3ab8436))
* chore(satellite): bump @types/node in /services/satellite ([e50b404](https://github.com/deploystackio/deploystack/commit/e50b404))
* chore(satellite): bump dotenv in /services/satellite ([5cb8a83](https://github.com/deploystackio/deploystack/commit/5cb8a83))
* fix(backend): handle property name differences in delete operation ([1444a10](https://github.com/deploystackio/deploystack/commit/1444a10))

## <small>0.33.1 (2025-09-15)</small>

* chore(backend): release v0.33.1 ([8ad733e](https://github.com/deploystackio/deploystack/commit/8ad733e))
* chore(satellite): release v0.2.1 ([a2a7295](https://github.com/deploystackio/deploystack/commit/a2a7295))
* chore(satellite): release v0.2.1 ([a67e9ff](https://github.com/deploystackio/deploystack/commit/a67e9ff))
* fix(all): remove unnecessary grep-or from commit logs in release scripts ([bcbdff7](https://github.com/deploystackio/deploystack/commit/bcbdff7))

## <small>0.33.1 (2025-09-15)</small>

* chore(all): update README to reflect completed tasks in Satellite MVP and Advanced Architecture phas ([3e0bd44](https://github.com/deploystackio/deploystack/commit/3e0bd44))
* chore(backend): release v0.33.0 ([4ff5141](https://github.com/deploystackio/deploystack/commit/4ff5141))
* chore(frontend): release v0.27.0 ([91cd9d5](https://github.com/deploystackio/deploystack/commit/91cd9d5))
* chore(frontend): release v0.27.0 ([832baab](https://github.com/deploystackio/deploystack/commit/832baab))
* chore(satellite): release v0.2.0 ([3d552de](https://github.com/deploystackio/deploystack/commit/3d552de))
* chore(satellite): release v0.2.0 ([8c795e1](https://github.com/deploystackio/deploystack/commit/8c795e1))
* chore(satellite): release v0.2.1 ([a2a7295](https://github.com/deploystackio/deploystack/commit/a2a7295))
* chore(satellite): release v0.2.1 ([a67e9ff](https://github.com/deploystackio/deploystack/commit/a67e9ff))
* fix(all): remove unnecessary grep-or for commit logs ([1e229d4](https://github.com/deploystackio/deploystack/commit/1e229d4))
* fix(all): remove unnecessary grep-or from commit logs in release scripts ([bcbdff7](https://github.com/deploystackio/deploystack/commit/bcbdff7))
* docs(all): remove IDE integrations and developer tools from To Do list ([a210486](https://github.com/deploystackio/deploystack/commit/a210486))
* docs(all): update README to improve clarity and structure with additional spacing ([857e74a](https://github.com/deploystackio/deploystack/commit/857e74a))
* docs(satellite): update README ([c0740a1](https://github.com/deploystackio/deploystack/commit/c0740a1))
* backend(fix): fixed console log ([420172d](https://github.com/deploystackio/deploystack/commit/420172d))
* refactor(satellite): removed gateway ([ecdcb91](https://github.com/deploystackio/deploystack/commit/ecdcb91))
* release satellite ([d7a5a10](https://github.com/deploystackio/deploystack/commit/d7a5a10))

## 0.33.0 (2025-09-15)

* chore(all): update README to reflect completed tasks in Satellite MVP and Advanced Architecture phas ([3e0bd44](https://github.com/deploystackio/deploystack/commit/3e0bd44))
* backend(fix): fixed console log ([420172d](https://github.com/deploystackio/deploystack/commit/420172d))
* refactor(satellite): removed gateway ([ecdcb91](https://github.com/deploystackio/deploystack/commit/ecdcb91))
* release satellite ([d7a5a10](https://github.com/deploystackio/deploystack/commit/d7a5a10))

## <small>0.32.1 (2025-09-05)</small>

* chore(backend): release v0.32.1 ([1b290ef](https://github.com/deploystackio/deploystack/commit/1b290ef))
* chore(gateway): release v0.12.0 ([3ea2abe](https://github.com/deploystackio/deploystack/commit/3ea2abe))
* chore(gateway): release v0.12.0 ([8aeac74](https://github.com/deploystackio/deploystack/commit/8aeac74))
* chore(release): update release command to include --no-increment option ([904e877](https://github.com/deploystackio/deploystack/commit/904e877))
* fix(backend): add nanoid package for unique ID generation ([b687aa6](https://github.com/deploystackio/deploystack/commit/b687aa6))
* feat(gateway): add 'clients' command to display connected MCP clients with detailed information ([faec3ca](https://github.com/deploystackio/deploystack/commit/faec3ca))
* feat(gateway): add client notification functionality and tools refresh endpoint ([925cd6e](https://github.com/deploystackio/deploystack/commit/925cd6e))
* refactor(gateway): remove tools refresh notification endpoint and client notification service ([3cdfc02](https://github.com/deploystackio/deploystack/commit/3cdfc02))

## <small>0.32.1 (2025-09-05)</small>

* fix(backend): add nanoid package for unique ID generation ([b687aa6](https://github.com/deploystackio/deploystack/commit/b687aa6))
* fix(database): implement safe database proxy for graceful startup handling ([68623a2](https://github.com/deploystackio/deploystack/commit/68623a2))
* fix(frontend): improve GitHub URL display and handling in featured servers ([06dfff3](https://github.com/deploystackio/deploystack/commit/06dfff3))
* fix(gateway): manage connections and improve server shutdown process ([80dd6f9](https://github.com/deploystackio/deploystack/commit/80dd6f9))
* fix(gateway): update default backend URL for login command to use cloud-api ([f71a14e](https://github.com/deploystackio/deploystack/commit/f71a14e))
* chore: specify Node.js and npm engine requirements in package.json and add .nvmrc ([8b0b3a9](https://github.com/deploystackio/deploystack/commit/8b0b3a9))
* chore: update package.json overrides and simplify README instructions ([0911ece](https://github.com/deploystackio/deploystack/commit/0911ece))
* chore(all): bump @types/nodemailer from 7.0.0 to 7.0.1 ([60b7fdc](https://github.com/deploystackio/deploystack/commit/60b7fdc))
* chore(all): bump @vueuse/core from 13.8.0 to 13.9.0 ([c32ca19](https://github.com/deploystackio/deploystack/commit/c32ca19))
* chore(all): bump drizzle-orm from 0.44.4 to 0.44.5 ([c2fda9b](https://github.com/deploystackio/deploystack/commit/c2fda9b))
* chore(all): bump eslint from 9.33.0 to 9.34.0 ([e2f0b7c](https://github.com/deploystackio/deploystack/commit/e2f0b7c))
* chore(all): bump inquirer from 12.9.3 to 12.9.4 ([a2e6ef8](https://github.com/deploystackio/deploystack/commit/a2e6ef8))
* chore(all): bump lucide-vue-next from 0.540.0 to 0.541.0 ([88e8acc](https://github.com/deploystackio/deploystack/commit/88e8acc))
* chore(all): bump lucide-vue-next from 0.541.0 to 0.542.0 ([b67d97b](https://github.com/deploystackio/deploystack/commit/b67d97b))
* chore(all): bump nodemailer from 7.0.5 to 7.0.6 ([f2c5a3f](https://github.com/deploystackio/deploystack/commit/f2c5a3f))
* chore(all): bump ts-loader from 9.5.2 to 9.5.4 ([4e2aeb0](https://github.com/deploystackio/deploystack/commit/4e2aeb0))
* chore(all): bump vite from 7.1.3 to 7.1.4 ([e67363d](https://github.com/deploystackio/deploystack/commit/e67363d))
* chore(all): bump vue from 3.5.18 to 3.5.20 ([d990c96](https://github.com/deploystackio/deploystack/commit/d990c96))
* chore(all): bump zod-openapi from 5.3.1 to 5.4.0 ([c4d77fe](https://github.com/deploystackio/deploystack/commit/c4d77fe))
* chore(all): update dependencies for frontend and backend packages ([204a8a1](https://github.com/deploystackio/deploystack/commit/204a8a1))
* chore(backend): release v0.32.0 ([b3c7341](https://github.com/deploystackio/deploystack/commit/b3c7341))
* chore(frontend): bump lucide-vue-next in /services/frontend ([e68b619](https://github.com/deploystackio/deploystack/commit/e68b619))
* chore(frontend): bump lucide-vue-next in /services/frontend ([f6fd104](https://github.com/deploystackio/deploystack/commit/f6fd104))
* chore(frontend): release v0.26.0 ([d09a5d1](https://github.com/deploystackio/deploystack/commit/d09a5d1))
* chore(frontend): release v0.26.1 ([b422f45](https://github.com/deploystackio/deploystack/commit/b422f45))
* chore(gateway): release v0.10.0 ([9bf462a](https://github.com/deploystackio/deploystack/commit/9bf462a))
* chore(gateway): release v0.10.1 ([cb3ef67](https://github.com/deploystackio/deploystack/commit/cb3ef67))
* chore(gateway): release v0.10.2 ([f9c3ddb](https://github.com/deploystackio/deploystack/commit/f9c3ddb))
* chore(gateway): release v0.11.0 ([3395bc9](https://github.com/deploystackio/deploystack/commit/3395bc9))
* chore(gateway): release v0.11.1 ([e92086b](https://github.com/deploystackio/deploystack/commit/e92086b))
* chore(gateway): release v0.12.0 ([3ea2abe](https://github.com/deploystackio/deploystack/commit/3ea2abe))
* chore(gateway): release v0.12.0 ([8aeac74](https://github.com/deploystackio/deploystack/commit/8aeac74))
* chore(gateway): release v0.9.0 ([75cecd4](https://github.com/deploystackio/deploystack/commit/75cecd4))
* chore(gateway): release v0.9.1 ([0bebfcd](https://github.com/deploystackio/deploystack/commit/0bebfcd))
* chore(gateway): release v0.9.2 ([bcf55f7](https://github.com/deploystackio/deploystack/commit/bcf55f7))
* chore(gateway): release v0.9.3 ([ca4f2ca](https://github.com/deploystackio/deploystack/commit/ca4f2ca))
* chore(gateway): release v0.9.4 ([4308f43](https://github.com/deploystackio/deploystack/commit/4308f43))
* chore(gateway): release v0.9.5 ([334e2cf](https://github.com/deploystackio/deploystack/commit/334e2cf))
* chore(release): update release command to include --no-increment option ([904e877](https://github.com/deploystackio/deploystack/commit/904e877))
* feat(all): Add translations for 'secret' data type in mcp-catalog ([463e580](https://github.com/deploystackio/deploystack/commit/463e580))
* feat(backend): implement device activity tracking service and integrate with MCP configurations rout ([481ce1e](https://github.com/deploystackio/deploystack/commit/481ce1e))
* feat(frontend): enhance RemoveDeviceDialog to use props for device removal and loading state ([eca1091](https://github.com/deploystackio/deploystack/commit/eca1091))
* feat(frontend): enhance user preferences handling for walkthrough ([80ff8ed](https://github.com/deploystackio/deploystack/commit/80ff8ed))
* feat(frontend): enhance walkthrough handling with improved checks and timing ([d073cab](https://github.com/deploystackio/deploystack/commit/d073cab))
* feat(frontend): update page title to 'DeployStack Cloud' ([8772df7](https://github.com/deploystackio/deploystack/commit/8772df7))
* feat(gateway): add 'clients' command to display connected MCP clients with detailed information ([faec3ca](https://github.com/deploystackio/deploystack/commit/faec3ca))
* feat(gateway): add client notification functionality and tools refresh endpoint ([925cd6e](https://github.com/deploystackio/deploystack/commit/925cd6e))
* feat(gateway): add selective restart functionality for MCP servers and enhance configuration change  ([f81f835](https://github.com/deploystackio/deploystack/commit/f81f835))
* feat(gateway): enhance login and logout commands with spinner feedback and improve console messages ([823af07](https://github.com/deploystackio/deploystack/commit/823af07))
* feat(gateway): enhance MCP configuration refresh with change detection ([00e1276](https://github.com/deploystackio/deploystack/commit/00e1276))
* feat(gateway): enhance status command with separate SSE and message endpoints ([2bef138](https://github.com/deploystackio/deploystack/commit/2bef138))
* feat(gateway): enhance team and user configuration decryption process ([6aeaad2](https://github.com/deploystackio/deploystack/commit/6aeaad2))
* feat(gateway): implement configuration change detection and handling with restart prompts ([62caf9c](https://github.com/deploystackio/deploystack/commit/62caf9c))
* feat(gateway): implement MCP endpoint and enhance logging for session management ([6a3332b](https://github.com/deploystackio/deploystack/commit/6a3332b))
* feat(gateway): mask internal backend URL in command outputs for improved user experience ([dfdfd9c](https://github.com/deploystackio/deploystack/commit/dfdfd9c))
* feat(gateway): refactor device detection and caching system for improved performance ([d676c9a](https://github.com/deploystackio/deploystack/commit/d676c9a))
* refactor: remove unnecessary console logs and improve user walkthrough handling ([f23f7b6](https://github.com/deploystackio/deploystack/commit/f23f7b6))
* refactor(gateway): remove tools refresh notification endpoint and client notification service ([3cdfc02](https://github.com/deploystackio/deploystack/commit/3cdfc02))
* refactor(gateway): remove unnecessary hints from MCP command error messages ([b65fade](https://github.com/deploystackio/deploystack/commit/b65fade))
* refactor(gateway): remove version string from command description ([6f2196a](https://github.com/deploystackio/deploystack/commit/6f2196a))
* refactor(gateway): replace legacy MCP config methods with new gateway endpoint ([914a49b](https://github.com/deploystackio/deploystack/commit/914a49b))

## 0.32.0 (2025-08-26)

* chore(all): bump drizzle-orm from 0.44.4 to 0.44.5 ([c2fda9b](https://github.com/deploystackio/deploystack/commit/c2fda9b))
* chore(all): bump lucide-vue-next from 0.540.0 to 0.541.0 ([88e8acc](https://github.com/deploystackio/deploystack/commit/88e8acc))
* chore(frontend): bump lucide-vue-next in /services/frontend ([f6fd104](https://github.com/deploystackio/deploystack/commit/f6fd104))
* chore(frontend): release v0.26.0 ([d09a5d1](https://github.com/deploystackio/deploystack/commit/d09a5d1))
* chore(frontend): release v0.26.1 ([b422f45](https://github.com/deploystackio/deploystack/commit/b422f45))
* chore(gateway): release v0.9.0 ([75cecd4](https://github.com/deploystackio/deploystack/commit/75cecd4))
* chore(gateway): release v0.9.1 ([0bebfcd](https://github.com/deploystackio/deploystack/commit/0bebfcd))
* feat(all): Add translations for 'secret' data type in mcp-catalog ([463e580](https://github.com/deploystackio/deploystack/commit/463e580))
* feat(gateway): enhance MCP configuration refresh with change detection ([00e1276](https://github.com/deploystackio/deploystack/commit/00e1276))
* feat(gateway): enhance team and user configuration decryption process ([6aeaad2](https://github.com/deploystackio/deploystack/commit/6aeaad2))
* refactor(gateway): replace legacy MCP config methods with new gateway endpoint ([914a49b](https://github.com/deploystackio/deploystack/commit/914a49b))
* fix(frontend): improve GitHub URL display and handling in featured servers ([06dfff3](https://github.com/deploystackio/deploystack/commit/06dfff3))

## <small>0.31.3 (2025-08-25)</small>

* chore(backend): release v0.31.2 ([77608e7](https://github.com/deploystackio/deploystack/commit/77608e7))
* feat(all): implement storage-first architecture in BasicInfoStepEdit component ([c9abb46](https://github.com/deploystackio/deploystack/commit/c9abb46))

## <small>0.31.2 (2025-08-25)</small>

* feat(all): implement storage-first architecture in BasicInfoStepEdit component ([c9abb46](https://github.com/deploystackio/deploystack/commit/c9abb46))

## <small>0.31.1 (2025-08-24)</small>

* chore(backend): release v0.31.0 ([5f7a5da](https://github.com/deploystackio/deploystack/commit/5f7a5da))
* chore(frontend): release v0.24.0 ([c001de7](https://github.com/deploystackio/deploystack/commit/c001de7))
* chore(frontend): release v0.24.1 ([a7a51fe](https://github.com/deploystackio/deploystack/commit/a7a51fe))
* chore(frontend): release v0.25.0 ([2097243](https://github.com/deploystackio/deploystack/commit/2097243))
* chore(frontend): release v0.25.1 ([e940bef](https://github.com/deploystackio/deploystack/commit/e940bef))
* chore(gateway): release v0.8.0 ([1b4931f](https://github.com/deploystackio/deploystack/commit/1b4931f))
* chore(gateway): release v0.8.1 ([d65fd36](https://github.com/deploystackio/deploystack/commit/d65fd36))
* feat(backend): implement CRUD operations for user devices ([74550da](https://github.com/deploystackio/deploystack/commit/74550da))
* feat(backend): rename device_name to device_id in API specifications ([f66d3d6](https://github.com/deploystackio/deploystack/commit/f66d3d6))
* feat(frontend): add success and error toasts for user configuration updates ([b021ddb](https://github.com/deploystackio/deploystack/commit/b021ddb))
* feat(frontend): add user arguments and configuration sections ([43a5fab](https://github.com/deploystackio/deploystack/commit/43a5fab))
* feat(frontend): add user configuration management to MCP server installation ([a709a37](https://github.com/deploystackio/deploystack/commit/a709a37))
* feat(frontend): enhance device detail view with i18n support ([41987b5](https://github.com/deploystackio/deploystack/commit/41987b5))
* feat(frontend): ensure fresh data loading in edit mode ([45bd18b](https://github.com/deploystackio/deploystack/commit/45bd18b))
* feat(frontend): replace device_name with device_id in user configuration ([54bf418](https://github.com/deploystackio/deploystack/commit/54bf418))
* feat(frontend): update argument field labels and placeholders ([c4aa090](https://github.com/deploystackio/deploystack/commit/c4aa090))
* feat(gateway): add endpoint to retrieve merged MCP configurations ([d13cd98](https://github.com/deploystackio/deploystack/commit/d13cd98))
* feat(gateway): implement device detection and new MCP config endpoint ([e5367c3](https://github.com/deploystackio/deploystack/commit/e5367c3))
* feat(gateway): implement graceful and forceful server stop functionality ([bf6cbe1](https://github.com/deploystackio/deploystack/commit/bf6cbe1))
* refactor(backend): improve user configuration validation logic ([468967d](https://github.com/deploystackio/deploystack/commit/468967d))
* refactor(backend): remove unnecessary permissions from user config routes ([b476825](https://github.com/deploystackio/deploystack/commit/b476825))
* refactor(backend): rename device_id to hardware_id in configurations ([12be78b](https://github.com/deploystackio/deploystack/commit/12be78b))
* refactor(frontend): improve user configuration display and structure ([e79efc0](https://github.com/deploystackio/deploystack/commit/e79efc0))
* refactor(frontend): separate user args and env in user configuration ([5616f7f](https://github.com/deploystackio/deploystack/commit/5616f7f))
* refactor(gateway): streamline device registration during OAuth2 flow ([55c38c0](https://github.com/deploystackio/deploystack/commit/55c38c0))
* fix(backend): change device removal to hard delete from database ([1335efb](https://github.com/deploystackio/deploystack/commit/1335efb))
* fix(backend): Refactor MCP User Configuration API to use object for user_args ([fa14c5a](https://github.com/deploystackio/deploystack/commit/fa14c5a))

## 0.31.0 (2025-08-24)

* chore(frontend): release v0.24.0 ([c001de7](https://github.com/deploystackio/deploystack/commit/c001de7))
* chore(frontend): release v0.24.1 ([a7a51fe](https://github.com/deploystackio/deploystack/commit/a7a51fe))
* chore(frontend): release v0.25.0 ([2097243](https://github.com/deploystackio/deploystack/commit/2097243))
* chore(frontend): release v0.25.1 ([e940bef](https://github.com/deploystackio/deploystack/commit/e940bef))
* chore(gateway): release v0.8.0 ([1b4931f](https://github.com/deploystackio/deploystack/commit/1b4931f))
* chore(gateway): release v0.8.1 ([d65fd36](https://github.com/deploystackio/deploystack/commit/d65fd36))
* feat(backend): implement CRUD operations for user devices ([74550da](https://github.com/deploystackio/deploystack/commit/74550da))
* feat(backend): rename device_name to device_id in API specifications ([f66d3d6](https://github.com/deploystackio/deploystack/commit/f66d3d6))
* feat(frontend): add success and error toasts for user configuration updates ([b021ddb](https://github.com/deploystackio/deploystack/commit/b021ddb))
* feat(frontend): add user arguments and configuration sections ([43a5fab](https://github.com/deploystackio/deploystack/commit/43a5fab))
* feat(frontend): add user configuration management to MCP server installation ([a709a37](https://github.com/deploystackio/deploystack/commit/a709a37))
* feat(frontend): enhance device detail view with i18n support ([41987b5](https://github.com/deploystackio/deploystack/commit/41987b5))
* feat(frontend): ensure fresh data loading in edit mode ([45bd18b](https://github.com/deploystackio/deploystack/commit/45bd18b))
* feat(frontend): replace device_name with device_id in user configuration ([54bf418](https://github.com/deploystackio/deploystack/commit/54bf418))
* feat(frontend): update argument field labels and placeholders ([c4aa090](https://github.com/deploystackio/deploystack/commit/c4aa090))
* feat(gateway): add endpoint to retrieve merged MCP configurations ([d13cd98](https://github.com/deploystackio/deploystack/commit/d13cd98))
* feat(gateway): implement device detection and new MCP config endpoint ([e5367c3](https://github.com/deploystackio/deploystack/commit/e5367c3))
* feat(gateway): implement graceful and forceful server stop functionality ([bf6cbe1](https://github.com/deploystackio/deploystack/commit/bf6cbe1))
* refactor(backend): improve user configuration validation logic ([468967d](https://github.com/deploystackio/deploystack/commit/468967d))
* refactor(backend): remove unnecessary permissions from user config routes ([b476825](https://github.com/deploystackio/deploystack/commit/b476825))
* refactor(backend): rename device_id to hardware_id in configurations ([12be78b](https://github.com/deploystackio/deploystack/commit/12be78b))
* refactor(frontend): improve user configuration display and structure ([e79efc0](https://github.com/deploystackio/deploystack/commit/e79efc0))
* refactor(frontend): separate user args and env in user configuration ([5616f7f](https://github.com/deploystackio/deploystack/commit/5616f7f))
* refactor(gateway): streamline device registration during OAuth2 flow ([55c38c0](https://github.com/deploystackio/deploystack/commit/55c38c0))
* fix(backend): change device removal to hard delete from database ([1335efb](https://github.com/deploystackio/deploystack/commit/1335efb))
* fix(backend): Refactor MCP User Configuration API to use object for user_args ([fa14c5a](https://github.com/deploystackio/deploystack/commit/fa14c5a))

## <small>0.30.1 (2025-08-23)</small>

* chore(all): bump @fastify/helmet from 12.0.1 to 13.0.1 ([6c460ff](https://github.com/deploystackio/deploystack/commit/6c460ff))
* chore(all): bump @libsql/client from 0.15.10 to 0.15.12 ([d071f7c](https://github.com/deploystackio/deploystack/commit/d071f7c))
* chore(all): bump @tailwindcss/postcss from 4.1.11 to 4.1.12 ([80e97dd](https://github.com/deploystackio/deploystack/commit/80e97dd))
* chore(all): bump @tailwindcss/vite from 4.1.11 to 4.1.12 ([ed7288c](https://github.com/deploystackio/deploystack/commit/ed7288c))
* chore(all): bump @types/node from 24.1.0 to 24.3.0 ([8691fce](https://github.com/deploystackio/deploystack/commit/8691fce))
* chore(all): bump @types/nodemailer from 6.4.17 to 7.0.0 ([18cd97e](https://github.com/deploystackio/deploystack/commit/18cd97e))
* chore(all): bump @types/uuid from 9.0.8 to 10.0.0 ([7550a88](https://github.com/deploystackio/deploystack/commit/7550a88))
* chore(all): bump @vueuse/core from 13.6.0 to 13.7.0 ([aa31039](https://github.com/deploystackio/deploystack/commit/aa31039))
* chore(all): bump chalk from 4.1.2 to 5.6.0 ([a42c3bb](https://github.com/deploystackio/deploystack/commit/a42c3bb))
* chore(all): bump drizzle-orm from 0.44.3 to 0.44.4 ([ec4d396](https://github.com/deploystackio/deploystack/commit/ec4d396))
* chore(all): bump eslint from 9.31.0 to 9.33.0 ([005d75f](https://github.com/deploystackio/deploystack/commit/005d75f))
* chore(all): bump fs-extra from 11.3.0 to 11.3.1 ([10f3e8d](https://github.com/deploystackio/deploystack/commit/10f3e8d))
* chore(all): bump inquirer from 12.9.1 to 12.9.3 ([44ebdc4](https://github.com/deploystackio/deploystack/commit/44ebdc4))
* chore(all): bump jest from 30.0.4 to 30.0.5 ([e488a6d](https://github.com/deploystackio/deploystack/commit/e488a6d))
* chore(all): bump jiti from 2.4.2 to 2.5.1 ([a402b2d](https://github.com/deploystackio/deploystack/commit/a402b2d))
* chore(all): bump lucide-vue-next from 0.539.0 to 0.540.0 ([e826d16](https://github.com/deploystackio/deploystack/commit/e826d16))
* chore(all): bump open from 8.4.2 to 10.2.0 ([c04c783](https://github.com/deploystackio/deploystack/commit/c04c783))
* chore(all): bump ora from 5.4.1 to 8.2.0 ([4d6c190](https://github.com/deploystackio/deploystack/commit/4d6c190))
* chore(all): bump pino from 9.8.0 to 9.9.0 ([2c17e56](https://github.com/deploystackio/deploystack/commit/2c17e56))
* chore(all): bump reka-ui from 2.3.2 to 2.4.1 ([ce311b8](https://github.com/deploystackio/deploystack/commit/ce311b8))
* chore(all): bump tailwindcss from 4.1.11 to 4.1.12 ([a51328d](https://github.com/deploystackio/deploystack/commit/a51328d))
* chore(all): bump ts-jest from 29.4.0 to 29.4.1 ([d8b52b4](https://github.com/deploystackio/deploystack/commit/d8b52b4))
* chore(all): bump typescript from 5.8.3 to 5.9.2 ([eaeddc0](https://github.com/deploystackio/deploystack/commit/eaeddc0))
* chore(all): bump vue-sonner from 2.0.2 to 2.0.8 ([2238b7f](https://github.com/deploystackio/deploystack/commit/2238b7f))
* chore(all): bump webpack from 5.101.2 to 5.101.3 ([16f2c7d](https://github.com/deploystackio/deploystack/commit/16f2c7d))
* chore(all): update branch cleanup workflow to include gateway-release branch ([351ef11](https://github.com/deploystackio/deploystack/commit/351ef11))
* chore(all): update release-it configuration for gateway service ([d1745e4](https://github.com/deploystackio/deploystack/commit/d1745e4))
* chore(backend): bump @types/nodemailer in /services/backend ([a80c28f](https://github.com/deploystackio/deploystack/commit/a80c28f))
* chore(backend): release v0.30.0 ([74dc303](https://github.com/deploystackio/deploystack/commit/74dc303))
* chore(frontend): bump @vue/tsconfig in /services/frontend ([b534363](https://github.com/deploystackio/deploystack/commit/b534363))
* chore(frontend): remove deprecated Account.vue backup file ([4d7ab8e](https://github.com/deploystackio/deploystack/commit/4d7ab8e))
* chore(frontend): update button loading states and improve form submission handling ([206a356](https://github.com/deploystackio/deploystack/commit/206a356))
* chore(frontend): update vite and fdir dependencies to latest versions ([7a28eb2](https://github.com/deploystackio/deploystack/commit/7a28eb2))
* chore(gateway): release v0.6.0 ([f6bf708](https://github.com/deploystackio/deploystack/commit/f6bf708))
* chore(gateway): release v0.6.1 ([7e7e409](https://github.com/deploystackio/deploystack/commit/7e7e409))
* chore(gateway): release v0.7.0 ([a181560](https://github.com/deploystackio/deploystack/commit/a181560))
* chore(gateway): release v0.7.1 ([cec7d41](https://github.com/deploystackio/deploystack/commit/cec7d41))
* chore(gateway): specify commits path for release-it configuration ([8aed4aa](https://github.com/deploystackio/deploystack/commit/8aed4aa))
* feat(all): featured server and pre-install mcp server ([f919b90](https://github.com/deploystackio/deploystack/commit/f919b90))
* feat(all): severl improvements to the env and arg system ([481ee39](https://github.com/deploystackio/deploystack/commit/481ee39))
* feat(all): update roadmap with new MCP configuration features ([97b0b2d](https://github.com/deploystackio/deploystack/commit/97b0b2d))
* feat(backend): add device information schema for OAuth2 token requests ([ae4cdd0](https://github.com/deploystackio/deploystack/commit/ae4cdd0))
* feat(backend): add error handling schemas for validation and internal server errors ([11c71ed](https://github.com/deploystackio/deploystack/commit/11c71ed))
* feat(backend): add event emissions for user and MCP server actions ([e35ed2d](https://github.com/deploystackio/deploystack/commit/e35ed2d))
* feat(backend): add structured logging to device revocation ([5344c1a](https://github.com/deploystackio/deploystack/commit/5344c1a))
* feat(backend): enhance MCP server creation and update descriptions ([69f4829](https://github.com/deploystackio/deploystack/commit/69f4829))
* feat(backend): env and arg on user team and user level ([374e6fb](https://github.com/deploystackio/deploystack/commit/374e6fb))
* feat(backend): implement global event bus for plugin communication ([3bbfbf5](https://github.com/deploystackio/deploystack/commit/3bbfbf5))
* feat(backend): implement user devices management API ([42afcc0](https://github.com/deploystackio/deploystack/commit/42afcc0))
* feat(backend): replace default_config with transport_type enum in MCP servers ([af7661a](https://github.com/deploystackio/deploystack/commit/af7661a))
* feat(backend): update device routes to include user context ([88a9af8](https://github.com/deploystackio/deploystack/commit/88a9af8))
* feat(backend): update device routes to use user context ([4ace49e](https://github.com/deploystackio/deploystack/commit/4ace49e))
* feat(backend): update user configuration routes and scopes for OAuth2 access ([fae0557](https://github.com/deploystackio/deploystack/commit/fae0557))
* feat(frontend): add featured server option to MCP server forms and views ([f91f3c7](https://github.com/deploystackio/deploystack/commit/f91f3c7))
* feat(frontend): add programming language selection to technical step ([538b258](https://github.com/deploystackio/deploystack/commit/538b258))
* feat(frontend): enhance server details view with ContentWrapper component ([d3a679f](https://github.com/deploystackio/deploystack/commit/d3a679f))
* feat(frontend): Enhance TechnicalStep component with hover card and improved configuration handling ([d8d4b69](https://github.com/deploystackio/deploystack/commit/d8d4b69))
* feat(frontend): Implement device management features including listing, viewing, editing, and removi ([4d2e332](https://github.com/deploystackio/deploystack/commit/4d2e332))
* feat(frontend): wrap step content in ContentWrapper component for improved layout ([2ffff37](https://github.com/deploystackio/deploystack/commit/2ffff37))
* feat(gateway): add 'deploystack refresh' command to refresh MCP server configurations ([e104b4c](https://github.com/deploystackio/deploystack/commit/e104b4c))
* feat(gateway): add 'restart' command to gracefully restart the gateway server ([a65d849](https://github.com/deploystackio/deploystack/commit/a65d849))
* feat(gateway): add logs streaming endpoint and centralized logging system ([44af50e](https://github.com/deploystackio/deploystack/commit/44af50e))
* feat(gateway): add user configuration retrieval and processing logic ([5ca072b](https://github.com/deploystackio/deploystack/commit/5ca072b))
* feat(gateway): implement automatic device registration during login ([a647196](https://github.com/deploystackio/deploystack/commit/a647196))
* feat(gateway): implement automatic device registration during OAuth2 flow ([5d89be8](https://github.com/deploystackio/deploystack/commit/5d89be8))
* feat(gateway): update dependencies and enhance login command to auto-start gateway server ([f5d7661](https://github.com/deploystackio/deploystack/commit/f5d7661))
* refactor(frontend): clean up code and improve readability in components ([96923ed](https://github.com/deploystackio/deploystack/commit/96923ed))
* refactor(frontend): improve team selection logic and error handling ([b8f24d6](https://github.com/deploystackio/deploystack/commit/b8f24d6))
* test(backend): replace default_config with transport_type in MCP server tests ([cbc6400](https://github.com/deploystackio/deploystack/commit/cbc6400))
* cicd(gateway): enhance release note extraction by including all relevant commits since the last tag ([3865b9d](https://github.com/deploystackio/deploystack/commit/3865b9d))
* cicd(release): enhance release note extraction for backend and frontend services ([59dee75](https://github.com/deploystackio/deploystack/commit/59dee75))

## 0.30.0 (2025-08-23)

* chore(all): bump @fastify/helmet from 12.0.1 to 13.0.1 ([6c460ff](https://github.com/deploystackio/deploystack/commit/6c460ff))
* chore(all): bump @libsql/client from 0.15.10 to 0.15.12 ([d071f7c](https://github.com/deploystackio/deploystack/commit/d071f7c))
* chore(all): bump @tailwindcss/postcss from 4.1.11 to 4.1.12 ([80e97dd](https://github.com/deploystackio/deploystack/commit/80e97dd))
* chore(all): bump @tailwindcss/vite from 4.1.11 to 4.1.12 ([ed7288c](https://github.com/deploystackio/deploystack/commit/ed7288c))
* chore(all): bump @types/node from 24.1.0 to 24.3.0 ([8691fce](https://github.com/deploystackio/deploystack/commit/8691fce))
* chore(all): bump @types/nodemailer from 6.4.17 to 7.0.0 ([18cd97e](https://github.com/deploystackio/deploystack/commit/18cd97e))
* chore(all): bump @types/uuid from 9.0.8 to 10.0.0 ([7550a88](https://github.com/deploystackio/deploystack/commit/7550a88))
* chore(all): bump @vueuse/core from 13.6.0 to 13.7.0 ([aa31039](https://github.com/deploystackio/deploystack/commit/aa31039))
* chore(all): bump chalk from 4.1.2 to 5.6.0 ([a42c3bb](https://github.com/deploystackio/deploystack/commit/a42c3bb))
* chore(all): bump drizzle-orm from 0.44.3 to 0.44.4 ([ec4d396](https://github.com/deploystackio/deploystack/commit/ec4d396))
* chore(all): bump eslint from 9.31.0 to 9.33.0 ([005d75f](https://github.com/deploystackio/deploystack/commit/005d75f))
* chore(all): bump fs-extra from 11.3.0 to 11.3.1 ([10f3e8d](https://github.com/deploystackio/deploystack/commit/10f3e8d))
* chore(all): bump inquirer from 12.9.1 to 12.9.3 ([44ebdc4](https://github.com/deploystackio/deploystack/commit/44ebdc4))
* chore(all): bump jest from 30.0.4 to 30.0.5 ([e488a6d](https://github.com/deploystackio/deploystack/commit/e488a6d))
* chore(all): bump jiti from 2.4.2 to 2.5.1 ([a402b2d](https://github.com/deploystackio/deploystack/commit/a402b2d))
* chore(all): bump lucide-vue-next from 0.539.0 to 0.540.0 ([e826d16](https://github.com/deploystackio/deploystack/commit/e826d16))
* chore(all): bump open from 8.4.2 to 10.2.0 ([c04c783](https://github.com/deploystackio/deploystack/commit/c04c783))
* chore(all): bump ora from 5.4.1 to 8.2.0 ([4d6c190](https://github.com/deploystackio/deploystack/commit/4d6c190))
* chore(all): bump pino from 9.8.0 to 9.9.0 ([2c17e56](https://github.com/deploystackio/deploystack/commit/2c17e56))
* chore(all): bump reka-ui from 2.3.2 to 2.4.1 ([ce311b8](https://github.com/deploystackio/deploystack/commit/ce311b8))
* chore(all): bump tailwindcss from 4.1.11 to 4.1.12 ([a51328d](https://github.com/deploystackio/deploystack/commit/a51328d))
* chore(all): bump ts-jest from 29.4.0 to 29.4.1 ([d8b52b4](https://github.com/deploystackio/deploystack/commit/d8b52b4))
* chore(all): bump typescript from 5.8.3 to 5.9.2 ([eaeddc0](https://github.com/deploystackio/deploystack/commit/eaeddc0))
* chore(all): bump vue-sonner from 2.0.2 to 2.0.8 ([2238b7f](https://github.com/deploystackio/deploystack/commit/2238b7f))
* chore(all): bump webpack from 5.101.2 to 5.101.3 ([16f2c7d](https://github.com/deploystackio/deploystack/commit/16f2c7d))
* chore(all): update branch cleanup workflow to include gateway-release branch ([351ef11](https://github.com/deploystackio/deploystack/commit/351ef11))
* chore(all): update release-it configuration for gateway service ([d1745e4](https://github.com/deploystackio/deploystack/commit/d1745e4))
* chore(backend): bump @types/nodemailer in /services/backend ([a80c28f](https://github.com/deploystackio/deploystack/commit/a80c28f))
* chore(frontend): bump @vue/tsconfig in /services/frontend ([b534363](https://github.com/deploystackio/deploystack/commit/b534363))
* chore(frontend): remove deprecated Account.vue backup file ([4d7ab8e](https://github.com/deploystackio/deploystack/commit/4d7ab8e))
* chore(frontend): update button loading states and improve form submission handling ([206a356](https://github.com/deploystackio/deploystack/commit/206a356))
* chore(frontend): update vite and fdir dependencies to latest versions ([7a28eb2](https://github.com/deploystackio/deploystack/commit/7a28eb2))
* chore(gateway): release v0.6.0 ([f6bf708](https://github.com/deploystackio/deploystack/commit/f6bf708))
* chore(gateway): release v0.6.1 ([7e7e409](https://github.com/deploystackio/deploystack/commit/7e7e409))
* chore(gateway): release v0.7.0 ([a181560](https://github.com/deploystackio/deploystack/commit/a181560))
* chore(gateway): release v0.7.1 ([cec7d41](https://github.com/deploystackio/deploystack/commit/cec7d41))
* chore(gateway): specify commits path for release-it configuration ([8aed4aa](https://github.com/deploystackio/deploystack/commit/8aed4aa))
* feat(all): featured server and pre-install mcp server ([f919b90](https://github.com/deploystackio/deploystack/commit/f919b90))
* feat(all): severl improvements to the env and arg system ([481ee39](https://github.com/deploystackio/deploystack/commit/481ee39))
* feat(all): update roadmap with new MCP configuration features ([97b0b2d](https://github.com/deploystackio/deploystack/commit/97b0b2d))
* feat(backend): add device information schema for OAuth2 token requests ([ae4cdd0](https://github.com/deploystackio/deploystack/commit/ae4cdd0))
* feat(backend): add error handling schemas for validation and internal server errors ([11c71ed](https://github.com/deploystackio/deploystack/commit/11c71ed))
* feat(backend): add event emissions for user and MCP server actions ([e35ed2d](https://github.com/deploystackio/deploystack/commit/e35ed2d))
* feat(backend): add structured logging to device revocation ([5344c1a](https://github.com/deploystackio/deploystack/commit/5344c1a))
* feat(backend): enhance MCP server creation and update descriptions ([69f4829](https://github.com/deploystackio/deploystack/commit/69f4829))
* feat(backend): env and arg on user team and user level ([374e6fb](https://github.com/deploystackio/deploystack/commit/374e6fb))
* feat(backend): implement global event bus for plugin communication ([3bbfbf5](https://github.com/deploystackio/deploystack/commit/3bbfbf5))
* feat(backend): implement user devices management API ([42afcc0](https://github.com/deploystackio/deploystack/commit/42afcc0))
* feat(backend): replace default_config with transport_type enum in MCP servers ([af7661a](https://github.com/deploystackio/deploystack/commit/af7661a))
* feat(backend): update device routes to include user context ([88a9af8](https://github.com/deploystackio/deploystack/commit/88a9af8))
* feat(backend): update device routes to use user context ([4ace49e](https://github.com/deploystackio/deploystack/commit/4ace49e))
* feat(backend): update user configuration routes and scopes for OAuth2 access ([fae0557](https://github.com/deploystackio/deploystack/commit/fae0557))
* feat(frontend): add featured server option to MCP server forms and views ([f91f3c7](https://github.com/deploystackio/deploystack/commit/f91f3c7))
* feat(frontend): add programming language selection to technical step ([538b258](https://github.com/deploystackio/deploystack/commit/538b258))
* feat(frontend): enhance server details view with ContentWrapper component ([d3a679f](https://github.com/deploystackio/deploystack/commit/d3a679f))
* feat(frontend): Enhance TechnicalStep component with hover card and improved configuration handling ([d8d4b69](https://github.com/deploystackio/deploystack/commit/d8d4b69))
* feat(frontend): Implement device management features including listing, viewing, editing, and removi ([4d2e332](https://github.com/deploystackio/deploystack/commit/4d2e332))
* feat(frontend): wrap step content in ContentWrapper component for improved layout ([2ffff37](https://github.com/deploystackio/deploystack/commit/2ffff37))
* feat(gateway): add 'deploystack refresh' command to refresh MCP server configurations ([e104b4c](https://github.com/deploystackio/deploystack/commit/e104b4c))
* feat(gateway): add 'restart' command to gracefully restart the gateway server ([a65d849](https://github.com/deploystackio/deploystack/commit/a65d849))
* feat(gateway): add logs streaming endpoint and centralized logging system ([44af50e](https://github.com/deploystackio/deploystack/commit/44af50e))
* feat(gateway): add user configuration retrieval and processing logic ([5ca072b](https://github.com/deploystackio/deploystack/commit/5ca072b))
* feat(gateway): implement automatic device registration during login ([a647196](https://github.com/deploystackio/deploystack/commit/a647196))
* feat(gateway): implement automatic device registration during OAuth2 flow ([5d89be8](https://github.com/deploystackio/deploystack/commit/5d89be8))
* feat(gateway): update dependencies and enhance login command to auto-start gateway server ([f5d7661](https://github.com/deploystackio/deploystack/commit/f5d7661))
* refactor(frontend): clean up code and improve readability in components ([96923ed](https://github.com/deploystackio/deploystack/commit/96923ed))
* refactor(frontend): improve team selection logic and error handling ([b8f24d6](https://github.com/deploystackio/deploystack/commit/b8f24d6))
* test(backend): replace default_config with transport_type in MCP server tests ([cbc6400](https://github.com/deploystackio/deploystack/commit/cbc6400))
* cicd(gateway): enhance release note extraction by including all relevant commits since the last tag ([3865b9d](https://github.com/deploystackio/deploystack/commit/3865b9d))
* cicd(release): enhance release note extraction for backend and frontend services ([59dee75](https://github.com/deploystackio/deploystack/commit/59dee75))

## <small>0.29.3 (2025-08-16)</small>

* release v0.29.2 ([715c35f](https://github.com/deploystackio/deploystack/commit/715c35fef890d6a33458eaf0efe701661068b425))
* enhance build process with webpack integration ([1aab8fa](https://github.com/deploystackio/deploystack/commit/1aab8faab83777f2f8d66befb3bd9654dfd043bf))

## <small>0.29.2 (2025-08-16)</small>

* enhance build process with webpack integration ([1aab8fa](https://github.com/deploystackio/deploystack/commit/1aab8faab83777f2f8d66befb3bd9654dfd043bf))

## <small>0.29.1 (2025-08-15)</small>

* update @typescript-eslint/parser to version 8.35.1 and add license information ([f4a2ab8](https://github.com/deploystackio/deploystack/commit/f4a2ab8d15866c490db17174eb88a133f26374aa))
* update @vitest/coverage-v8 dependency to version 3.2.3 ([85d35fa](https://github.com/deploystackio/deploystack/commit/85d35fa8472272966ea9707ca64ef8575e687080))
* update backend version to 0.20.2 and typescript-eslint to 8.33.0 ([24ef17d](https://github.com/deploystackio/deploystack/commit/24ef17dc0c626b4e8f9baf47e4c0a89d103daf97))
* bump @fastify/cors from 8.5.0 to 11.1.0 ([fd81688](https://github.com/deploystackio/deploystack/commit/fd816882654e4872d6722fcccaeccc0b1c80b742))
* bump @libsql/client from 0.14.0 to 0.15.9 ([abcbe01](https://github.com/deploystackio/deploystack/commit/abcbe01ffc8d79087cf6c5d947406a584a7cd5a5))
* bump @libsql/client from 0.15.9 to 0.15.10 ([f7b42a3](https://github.com/deploystackio/deploystack/commit/f7b42a3f8a07352c6333db1d893e98ce466b381a))
* bump @octokit/auth-app from 8.0.1 to 8.0.2 ([e570cd7](https://github.com/deploystackio/deploystack/commit/e570cd7a3fc931828b1ae16d09dce4c377dfa6f3))
* bump @tailwindcss/postcss from 4.1.10 to 4.1.11 ([b4f69a9](https://github.com/deploystackio/deploystack/commit/b4f69a94f1133ed9a83ae4241416fce4d960c0d7))
* bump @tailwindcss/postcss from 4.1.7 to 4.1.8 ([920fac2](https://github.com/deploystackio/deploystack/commit/920fac2bed5db877d313da0e23ffed9d68fc95d7))
* bump @tailwindcss/postcss from 4.1.8 to 4.1.10 ([5a7e8fc](https://github.com/deploystackio/deploystack/commit/5a7e8fce97f62d3dc4049edae3985c50175a1aa5))
* bump @tailwindcss/vite from 4.1.10 to 4.1.11 ([2343d7f](https://github.com/deploystackio/deploystack/commit/2343d7fbce3b614dc9141f05b5238d60cf68ac6c))
* bump @tailwindcss/vite from 4.1.7 to 4.1.8 ([5e9ed8a](https://github.com/deploystackio/deploystack/commit/5e9ed8ac2b3fb126e11720aa7cd512f71f38b60e))
* bump @types/node from 22.15.29 to 24.0.3 ([7ac5170](https://github.com/deploystackio/deploystack/commit/7ac51707ebaf8dc294f5e57e3489a958dc1b85bc))
* bump @types/node from 24.0.10 to 24.0.13 ([18e7601](https://github.com/deploystackio/deploystack/commit/18e7601f92dd2892d736175254b755b4edecc770))
* bump @types/node from 24.0.13 to 24.0.15 ([4d7f6a1](https://github.com/deploystackio/deploystack/commit/4d7f6a1eeb49129c377f89fa9f042b0f06b7d3e9))
* bump @types/node from 24.0.3 to 24.0.7 ([b75678a](https://github.com/deploystackio/deploystack/commit/b75678a61fcad159acc35af1ef7df726ee84ddcc))
* bump @typescript-eslint/eslint-plugin from 8.35.0 to 8.35.1 ([c29b270](https://github.com/deploystackio/deploystack/commit/c29b270ef2dbd142ecf387690705a05a38358351))
* bump @typescript-eslint/eslint-plugin from 8.35.1 to 8.36.0 ([66f29be](https://github.com/deploystackio/deploystack/commit/66f29bee424eb44a342c5ffa285239620467c46e))
* bump @typescript-eslint/parser from 8.32.1 to 8.33.0 ([04fd3c8](https://github.com/deploystackio/deploystack/commit/04fd3c88c842cc4f1a56f5441e3790350cbe61bf))
* bump @typescript-eslint/parser from 8.34.1 to 8.35.0 ([360d00f](https://github.com/deploystackio/deploystack/commit/360d00f0c306c464f56fbd983bd9121e84e16d78))
* bump @typescript-eslint/parser from 8.37.0 to 8.38.0 ([e3cf2f8](https://github.com/deploystackio/deploystack/commit/e3cf2f84feaa9e80b2e9d5d464bed41feb6ffc2e))
* bump @typescript-eslint/parser from 8.38.0 to 8.39.1 ([dc84016](https://github.com/deploystackio/deploystack/commit/dc8401637ec7ccd564ffb5cd9541d9c914432547))
* bump @vitejs/plugin-vue from 5.2.4 to 6.0.0 ([59969d4](https://github.com/deploystackio/deploystack/commit/59969d4aeeea8b6d0c4dcb833ea280fd815d333d))
* bump @vitejs/plugin-vue from 6.0.0 to 6.0.1 ([60dfc78](https://github.com/deploystackio/deploystack/commit/60dfc7875d7afa4a71a6f56ac71f5b422b588bee))
* bump @vue/eslint-config-typescript from 14.5.1 to 14.6.0 ([2cfd83a](https://github.com/deploystackio/deploystack/commit/2cfd83a326771b274eddca16bb19bbf71a48a220))
* bump @vueuse/core from 13.5.0 to 13.6.0 ([602257f](https://github.com/deploystackio/deploystack/commit/602257feafc534c7ea8e2e455e6eac1109d336cc))
* bump argon2 from 0.43.0 to 0.43.1 ([cb29155](https://github.com/deploystackio/deploystack/commit/cb29155798c7696cd90b0d9c61cd2b3723baeb90))
* bump argon2 from 0.43.1 to 0.44.0 ([c4384e9](https://github.com/deploystackio/deploystack/commit/c4384e94193623bd69a7622ba478c3d2a2b9e672))
* bump better-sqlite3 from 12.1.1 to 12.2.0 ([9f7dcd5](https://github.com/deploystackio/deploystack/commit/9f7dcd575ce39ff981c39aa1b269984ae7e2900f))
* bump commander from 12.1.0 to 14.0.0 ([ef42a93](https://github.com/deploystackio/deploystack/commit/ef42a931d01aceabb6e97cf2474b0038cde33ee4))
* bump drizzle-orm from 0.44.1 to 0.44.2 ([c8f9d0f](https://github.com/deploystackio/deploystack/commit/c8f9d0f06ce2e1e15e2412235a20b397b5c79bf4))
* bump drizzle-orm from 0.44.2 to 0.44.3 ([f62c189](https://github.com/deploystackio/deploystack/commit/f62c1898f18db83dd0d5de3c959a7056f5be7f80))
* bump eslint from 9.28.0 to 9.29.0 ([2957728](https://github.com/deploystackio/deploystack/commit/29577289f6f2fcacb6ae79a871b8100b154e1f8b))
* bump eslint from 9.29.0 to 9.30.0 ([6ea09aa](https://github.com/deploystackio/deploystack/commit/6ea09aafd6e4ff73a3fbc237efbc46ab54959ebd))
* bump eslint from 9.30.1 to 9.31.0 ([2d00015](https://github.com/deploystackio/deploystack/commit/2d000150ddbcad323ce1e37cdb6129e2024b37c3))
* bump eslint-plugin-vue from 10.2.0 to 10.3.0 ([c871268](https://github.com/deploystackio/deploystack/commit/c87126845eb333fad990e561476f00fb2a21c434))
* bump eslint-plugin-vue from 10.3.0 to 10.4.0 ([cb522f8](https://github.com/deploystackio/deploystack/commit/cb522f84a733970960f33691e3ea90c163efefb7))
* bump fastify from 5.3.3 to 5.4.0 ([d2516af](https://github.com/deploystackio/deploystack/commit/d2516afce97b1618f670d240a24fde34632dc532))
* bump inquirer from 8.2.6 to 12.9.1 ([91e3f6a](https://github.com/deploystackio/deploystack/commit/91e3f6a7e4ad721d0d0009edb510993f80ec5969))
* bump jest from 30.0.3 to 30.0.4 ([3d8e5cc](https://github.com/deploystackio/deploystack/commit/3d8e5cc043b66fde1fc0f2711498d0b16fda0128))
* bump lucide-vue-next from 0.511.0 to 0.522.0 ([0bbe36c](https://github.com/deploystackio/deploystack/commit/0bbe36ce8e9284a09a592d07d8121ff78b2df12a))
* bump lucide-vue-next from 0.525.0 to 0.539.0 ([fed7846](https://github.com/deploystackio/deploystack/commit/fed78461eee9b1512270e07bf48de3b8f84d5476))
* bump nodemailer from 6.10.1 to 7.0.3 ([3d64c24](https://github.com/deploystackio/deploystack/commit/3d64c2406a76e2ec3ee5d2516ea476f52888aca6))
* bump nodemailer from 7.0.3 to 7.0.4 ([f27d521](https://github.com/deploystackio/deploystack/commit/f27d5216800e88ffed2a91aa686e477c700b5729))
* bump nodemailer from 7.0.4 to 7.0.5 ([48b326d](https://github.com/deploystackio/deploystack/commit/48b326d9a976bb0572ec7f64c1d0779ce1281138))
* bump pinia from 3.0.2 to 3.0.3 ([4ecda4a](https://github.com/deploystackio/deploystack/commit/4ecda4a7f5d9be6b000e2dd0fe7cb0763782a1ae))
* bump pino from 9.7.0 to 9.8.0 ([9b658c9](https://github.com/deploystackio/deploystack/commit/9b658c9b1d20e9f48877eb135bddda145947a548))
* bump pino-pretty from 13.0.0 to 13.1.1 ([72b68da](https://github.com/deploystackio/deploystack/commit/72b68da3d8b884f18d6e62d12e4e4aa1222750a9))
* bump release-it from 19.0.3 to 19.0.4 ([897c63c](https://github.com/deploystackio/deploystack/commit/897c63cbadc407b239da2ea33e40fb9ee684d694))
* bump supertest from 7.1.1 to 7.1.2 ([bc17573](https://github.com/deploystackio/deploystack/commit/bc17573026322485f6728029cb508616331b7650))
* bump supertest from 7.1.2 to 7.1.3 ([7df6824](https://github.com/deploystackio/deploystack/commit/7df682481603c6111c6777bcef7037bad81e20b4))
* bump supertest from 7.1.3 to 7.1.4 ([6299ab3](https://github.com/deploystackio/deploystack/commit/6299ab3d2bfaef995d8dced6fdef23bdff37a839))
* bump tailwind-merge from 3.3.0 to 3.3.1 ([52dc1ff](https://github.com/deploystackio/deploystack/commit/52dc1ffbb8b763c6d4b83fe2ea51cf67c3be142f))
* bump tailwindcss from 4.1.10 to 4.1.11 ([e09ae4f](https://github.com/deploystackio/deploystack/commit/e09ae4fac26c3b9442f2cfa59fe747ccbe366a6c))
* bump ts-jest from 29.3.4 to 29.4.0 ([c299e81](https://github.com/deploystackio/deploystack/commit/c299e81f9b282e0b5d9a20ff88f0813f9c9ae429))
* bump typescript-eslint from 8.33.0 to 8.34.1 ([7066639](https://github.com/deploystackio/deploystack/commit/706663967bc897629f7f421594c20e95eb3e5ac8))
* bump typescript-eslint from 8.34.1 to 8.35.0 ([686ab27](https://github.com/deploystackio/deploystack/commit/686ab2719af1548e662b993f83e8b6ed817e15eb))
* bump typescript-eslint from 8.35.0 to 8.35.1 ([dd92767](https://github.com/deploystackio/deploystack/commit/dd92767e8f4943bcd45f48b8d9d15b29efd6bffe))
* bump typescript-eslint from 8.35.1 to 8.36.0 ([3786ff8](https://github.com/deploystackio/deploystack/commit/3786ff886686e8391c9f432ad395e15fed8c21b0))
* bump typescript-eslint from 8.36.0 to 8.37.0 ([e4c3fb3](https://github.com/deploystackio/deploystack/commit/e4c3fb3fe42fab1c2c2f8f0556bd7e7c0430f924))
* bump typescript-eslint from 8.37.0 to 8.38.0 ([ba3ca5b](https://github.com/deploystackio/deploystack/commit/ba3ca5b3245293699698fdf7cb84736cb62e7039))
* bump uuid from 9.0.1 to 11.1.0 ([6a7e064](https://github.com/deploystackio/deploystack/commit/6a7e0649b3a603186b3e5e3e8d51de433354d7ef))
* bump vee-validate from 4.15.0 to 4.15.1 ([d2ce63e](https://github.com/deploystackio/deploystack/commit/d2ce63eb1c8faba71ff7a9087b8fa47ee11e264d))
* bump vite from 6.3.5 to 7.0.0 ([4531c42](https://github.com/deploystackio/deploystack/commit/4531c422d3d7b361ae366d031279b337d83a3b74))
* bump vite from 7.0.2 to 7.0.4 ([eb9bde5](https://github.com/deploystackio/deploystack/commit/eb9bde5eea42eb19c554990e0e12817e7cf8443e))
* bump vite from 7.0.4 to 7.0.5 ([d51de0c](https://github.com/deploystackio/deploystack/commit/d51de0c0f488886099e1640192cb0776b61e069d))
* bump vite-plugin-vue-devtools from 7.7.7 to 8.0.0 ([3fc1d22](https://github.com/deploystackio/deploystack/commit/3fc1d223951e428aa9c5b888acfbf549a65d37da))
* bump vitest from 2.1.9 to 3.2.3 ([350bdc4](https://github.com/deploystackio/deploystack/commit/350bdc48990fcf302a06d5b4c0ad197dfd7fc904))
* bump vue from 3.5.16 to 3.5.17 ([6ff47ae](https://github.com/deploystackio/deploystack/commit/6ff47ae58d0d12b94f14ded427bef920dc951c7f))
* bump vue from 3.5.17 to 3.5.18 ([97ff56b](https://github.com/deploystackio/deploystack/commit/97ff56b23b8b5895aa9a5717becba1dbe640353a))
* bump vue-i18n from 11.1.10 to 11.1.11 ([34d5417](https://github.com/deploystackio/deploystack/commit/34d54178665d3d9765151634de8ebb68f11a0d7a))
* bump vue-i18n from 11.1.4 to 11.1.5 ([ef10230](https://github.com/deploystackio/deploystack/commit/ef10230a76cba1b16f6f74681768156fffb90e44))
* bump vue-i18n from 11.1.7 to 11.1.9 ([c96cd74](https://github.com/deploystackio/deploystack/commit/c96cd7463cefc958799fea73e577a65f707559a1))
* bump vue-i18n from 11.1.9 to 11.1.10 ([0b278ac](https://github.com/deploystackio/deploystack/commit/0b278ac9219cbf9f3434857619f6a6b3a851b1bd))
* bump vue-tsc from 2.2.10 to 3.0.1 ([b862db9](https://github.com/deploystackio/deploystack/commit/b862db9e6a69e42810547cef9cff24d699da77bd))
* bump vue-tsc from 3.0.1 to 3.0.3 ([6ba75bd](https://github.com/deploystackio/deploystack/commit/6ba75bd3210c117adcd4b253b2e7ac55bb0e41ce))
* bump vue-tsc from 3.0.3 to 3.0.5 ([7fa11a1](https://github.com/deploystackio/deploystack/commit/7fa11a1968d747475c240b800ff5d8a48db4392b))
* bump zod from 3.25.28 to 3.25.36 ([54d38b8](https://github.com/deploystackio/deploystack/commit/54d38b8091ed5f039c4d960061f902cd9e2c1134))
* bump zod from 3.25.49 to 3.25.65 ([b806058](https://github.com/deploystackio/deploystack/commit/b8060585c55f4cf6773b552c0ea0014c10a031b5))
* bump zod from 3.25.67 to 3.25.75 ([87b5322](https://github.com/deploystackio/deploystack/commit/87b5322d86d45e41565f4d73c3035ccefb9acd84))
* bump zod from 3.25.76 to 4.0.5 ([a436cab](https://github.com/deploystackio/deploystack/commit/a436cab82dfce148fa7237da4bfd75bde0997ff9))
* bump zod from 4.0.5 to 4.0.17 ([93b19af](https://github.com/deploystackio/deploystack/commit/93b19afecc31ecc71e15e9bca0154601f0b21721))
* bump zod-openapi from 5.2.0 to 5.3.1 ([30e0b04](https://github.com/deploystackio/deploystack/commit/30e0b04c68606f4b4bbc6805fc5e2c95e0198146))
* bump zod-to-json-schema from 3.24.5 to 3.24.6 ([b1dde4c](https://github.com/deploystackio/deploystack/commit/b1dde4c86e3df9108c2a420749f887f12bcfd7ad))
* remove scoped commit implementation documentation ([57c6b9c](https://github.com/deploystackio/deploystack/commit/57c6b9c969419e23498e4a6dee06c26970ef4b31))
* add paths for backend catalog and dereferenced data ([225c46f](https://github.com/deploystackio/deploystack/commit/225c46f3c94582c9ee26d8683425c35e21c585ea))
* bump @libsql/client in /services/backend ([01e0877](https://github.com/deploystackio/deploystack/commit/01e0877a4f974f22cd7473df29dd6f76025996be))
* bump @types/jest in /services/backend ([516aa27](https://github.com/deploystackio/deploystack/commit/516aa273dd6e34dce84fda1e18d06a1e7e0ae9ce))
* bump drizzle-orm in /services/backend ([c75e00f](https://github.com/deploystackio/deploystack/commit/c75e00ff17255ae6e178f79f49b761400584c6c6))
* bump jest from 29.7.0 to 30.0.0 in /services/backend ([4e5d7fc](https://github.com/deploystackio/deploystack/commit/4e5d7fc53a92e719ba9ba29bda85ecf631098c4f))
* bump zod from 3.25.76 to 4.0.5 in /services/backend ([bd66143](https://github.com/deploystackio/deploystack/commit/bd6614321a80e4ed917ec4e4aa0479f2ac0647c0))
* improve logging structure for error handling ([7e9fae2](https://github.com/deploystackio/deploystack/commit/7e9fae2ebbaf793e148843aed4bea37f3ee80e72))
* release v0.20.0 ([deef84f](https://github.com/deploystackio/deploystack/commit/deef84fca2a689b3661dce56640d8bf902fb9102))
* release v0.20.1 ([82b34e8](https://github.com/deploystackio/deploystack/commit/82b34e87b46dcd293d537702b3295ba72679d44e))
* release v0.20.2 ([33d5026](https://github.com/deploystackio/deploystack/commit/33d5026d3a0d5f59f7f535174898b9e6a57997b5))
* release v0.20.3 ([c9ca248](https://github.com/deploystackio/deploystack/commit/c9ca2488f668892b2875cedf4a583dfde7db1c03))
* release v0.20.4 ([22d5b1d](https://github.com/deploystackio/deploystack/commit/22d5b1d7af821c56ba034ed465ed50c5932f2951))
* release v0.20.5 ([1c55060](https://github.com/deploystackio/deploystack/commit/1c550601586bb0d514a38d35da4cd9e5389c9cf9))
* release v0.20.6 ([c6e8cbb](https://github.com/deploystackio/deploystack/commit/c6e8cbb410e61d58e3db3231612b8733e3f1d7ce))
* release v0.20.7 ([4f3b4b9](https://github.com/deploystackio/deploystack/commit/4f3b4b9893381e48d7d3314a20d2f6a5f0b5d773))
* release v0.20.8 ([504a74c](https://github.com/deploystackio/deploystack/commit/504a74c18c10a393e107a7a64f855041aef4b14a))
* release v0.20.9 ([890d417](https://github.com/deploystackio/deploystack/commit/890d4174c766a9783571e6e6935a25cce0c37fac))
* release v0.21.0 ([c3ca83c](https://github.com/deploystackio/deploystack/commit/c3ca83c6cab1d2b094d9217950381e7f71945ebd))
* release v0.21.1 ([0ad5fee](https://github.com/deploystackio/deploystack/commit/0ad5fee6e66c4eea3eaabf0f318e69e8f0bcc9e1))
* release v0.22.0 ([1969cd0](https://github.com/deploystackio/deploystack/commit/1969cd000655747b72647e0e8cedffcbc6ab3de8))
* release v0.22.1 ([5e6e2be](https://github.com/deploystackio/deploystack/commit/5e6e2be230ec68806f4d4bd797551b9f1806c86e))
* release v0.23.0 ([9fa9207](https://github.com/deploystackio/deploystack/commit/9fa92073ef3f8c27a94987243f8141a43017bf8b))
* release v0.23.1 ([4ff8148](https://github.com/deploystackio/deploystack/commit/4ff8148787bbdfd6ca0a1c41eebb8cfdce6d4357))
* release v0.24.0 ([7014acd](https://github.com/deploystackio/deploystack/commit/7014acdca257178fd3f534d31b966db51a3b57c5))
* release v0.24.1 ([c876c83](https://github.com/deploystackio/deploystack/commit/c876c837c75ef004632c6a1ed66914df7b32b961))
* release v0.25.0 ([16833e4](https://github.com/deploystackio/deploystack/commit/16833e4e076c65e5aee266e4ae60ac068ae240ff))
* release v0.25.1 ([5e66dce](https://github.com/deploystackio/deploystack/commit/5e66dcede58059fef26951ee3ba498de074f4016))
* release v0.26.0 ([5ca4e67](https://github.com/deploystackio/deploystack/commit/5ca4e6731761ac0b1b68310e17c2ae88cb9bc7ba))
* release v0.26.1 ([15d8719](https://github.com/deploystackio/deploystack/commit/15d8719aa33185ce94784b8a96705dd7ad4f1a8a))
* release v0.27.0 ([7bba1ef](https://github.com/deploystackio/deploystack/commit/7bba1efd3e0aa3aba26c7d83f4368992e4aba317))
* release v0.27.1 ([7f19fb9](https://github.com/deploystackio/deploystack/commit/7f19fb935461571c8cdf835b169d7be0e670a82f))
* release v0.28.0 ([842f14c](https://github.com/deploystackio/deploystack/commit/842f14c45694174eb671e832a03a9b6c8fa4a685))
* release v0.28.1 ([d0013f7](https://github.com/deploystackio/deploystack/commit/d0013f755ec6417a8cdc18fd846fbdc9012fcae3))
* release v0.28.2 ([1eea8d4](https://github.com/deploystackio/deploystack/commit/1eea8d4aaee0993b61f8b4441399277d593350bc))
* release v0.28.3 ([adf8120](https://github.com/deploystackio/deploystack/commit/adf8120a3182f1ab7d88375625ab76c721c0ab6a))
* release v0.29.0 ([95e4fb5](https://github.com/deploystackio/deploystack/commit/95e4fb5d6d6d68076d9ce7fcee23464e09357fa7))
* update environment configuration and README for Docker ([5ab8d49](https://github.com/deploystackio/deploystack/commit/5ab8d496ad0c95a7e16a62c3c012b22b1ca9bf51))
* update rootDir in tsconfig.json to 'src' ([0d58329](https://github.com/deploystackio/deploystack/commit/0d58329cbe5c16decc7869157aadf643fae2dc9e))
* add missing line breaks in Docker command examples for clarity ([94d1571](https://github.com/deploystackio/deploystack/commit/94d1571970dbb53b5ef5ea570b4bea223f07e0f0))
* add newline to commitPartial format for better readability ([4e36538](https://github.com/deploystackio/deploystack/commit/4e365382552a301a318b10a5f9c39bf4aed805ed))
* add permissions for issues in backend release workflow ([9b100b8](https://github.com/deploystackio/deploystack/commit/9b100b88c7afed44dbae389f27623e2239fa8e14))
* avoid modifying immutable commit object in release-it transform ([4daad29](https://github.com/deploystackio/deploystack/commit/4daad298d6e113826af92db42f3d7511974323e1))
* clean up empty markdown links and remove empty lines from release notes extraction ([e39b183](https://github.com/deploystackio/deploystack/commit/e39b183268d08b6972eb9c225fcf0dde7922d862))
* correct plugin paths configuration for better clarity and maintainability ([bcb334f](https://github.com/deploystackio/deploystack/commit/bcb334f7eda16cae54d85e2c89c857b8b55d6ef7))
* disable eslint rule for explicit any in cloud providers and cloud credentials routes ([5c0eb3b](https://github.com/deploystackio/deploystack/commit/5c0eb3b70422aad22562bd68c6c45fef32af118d))
* enhance error handling for database connection and update error messages ([dbb7c1d](https://github.com/deploystackio/deploystack/commit/dbb7c1d6feddf2810151de8adc2a88bfffa96e7a))
* enhance frontend release workflow with improved dependency installation and build handling ([d9f2fe1](https://github.com/deploystackio/deploystack/commit/d9f2fe176b195999a74c7cf3eb476c95312ecb19))
* enhance release notes extraction in backend release workflow ([8d1be5f](https://github.com/deploystackio/deploystack/commit/8d1be5fee9ff8b47f9caa1422fba755d2f7a9f8c))
* hardcode GitHub repository URL in commit links for changelog ([b018577](https://github.com/deploystackio/deploystack/commit/b0185776aa878c7db22b201060fc89e83cd76dd6))
* improve frontend release workflow with enhanced dependency installation and release notes extraction ([edd0a39](https://github.com/deploystackio/deploystack/commit/edd0a3914d510aaa0106599d9a7f991be30f82f6))
* remove unnecessary empty markdown link cleanup from workflows ([c1054c7](https://github.com/deploystackio/deploystack/commit/c1054c77c82b3c903879ac7076ec0c41186453ef))
* update base URL and enhance fetch requests with session management ([30291cc](https://github.com/deploystackio/deploystack/commit/30291ccdcd4975c7b4ac6ede5972b0491b96b343))
* update conventional changelog plugin configuration for backend and frontend ([82ff531](https://github.com/deploystackio/deploystack/commit/82ff531b801e2a3c785b179809599342e42da534))
* update Docker run command for frontend environment variables ([529c37f](https://github.com/deploystackio/deploystack/commit/529c37f37172cc2b3d4c4f1ed28685796fdb701e))
* update Docker run command to map port 8080 to 80 for frontend ([2d12bad](https://github.com/deploystackio/deploystack/commit/2d12badc5343e2cb02c6e97755595277066c3df4))
* update environment variable display to use variable name instead of index ([1216346](https://github.com/deploystackio/deploystack/commit/12163468c2594dab00c643fe12b3e2f35822ee8f))
* update environment variable names for frontend and backend URLs in Docker commands and CORS configuration ([c0e3ec8](https://github.com/deploystackio/deploystack/commit/c0e3ec843e124a741a37870e52748973842e849e))
* update error handling to include Bad Request status for invalid credentials ([93d5ee7](https://github.com/deploystackio/deploystack/commit/93d5ee7740af465edad517179566ec9c802d7985))
* update ESLint configuration to ignore temporary TypeScript files and remove unused type imports in global settings and plugin manager ([b443bba](https://github.com/deploystackio/deploystack/commit/b443bba8317e95f5461b85430ebcd479aa78207c))
* update favicon.ico for improved branding ([3229465](https://github.com/deploystackio/deploystack/commit/3229465540469e60f4fbe2a83846df921ebae0b4))
* update release notes extraction to reference the correct paths for version and changelog ([2830b80](https://github.com/deploystackio/deploystack/commit/2830b801c4cc875c47595efb7092b2ff9998d31c))
* update release type options to remove 'auto' and set default to 'patch' ([e471253](https://github.com/deploystackio/deploystack/commit/e47125393dff084bc646ea5a44198ee62e9fb2fa))
* update release-it configuration to properly format commit links in changelog ([ea538d9](https://github.com/deploystackio/deploystack/commit/ea538d983a46b69ec0097672a022510e4fb216d6))
* update security documentation to clarify key security dependencies ([f851ba5](https://github.com/deploystackio/deploystack/commit/f851ba5c10a5eb9b124cfca4f89058e0c1db78d8))
* update storage key handling in DatabaseService to use dynamic baseUrl ([0c27b13](https://github.com/deploystackio/deploystack/commit/0c27b138a97968d39c3fee21406adc12dd8e74b9))
* update timestamp creation to use Date object instead of Date.now() in createGroups method ([45d07fa](https://github.com/deploystackio/deploystack/commit/45d07fa984fc8ed0e589aaaa945482856b5aac25))
* use proper URL template variables for commit links in changelog ([dc5c9c5](https://github.com/deploystackio/deploystack/commit/dc5c9c532d7c96c7705ef2e588c692487099e045))
* correct casing in email service imports and routes ([42a145e](https://github.com/deploystackio/deploystack/commit/42a145e62d5dd688fa4cd027edca657c9715a709))
* correct import paths for email routes and services ([1acc16c](https://github.com/deploystackio/deploystack/commit/1acc16cf0af39fc65790e251d28d3f8745cce88d))
* specify error type as unknown in catch blocks ([6563ad1](https://github.com/deploystackio/deploystack/commit/6563ad120eab2c20d27964b0727fc831a04e281e))
* specify error type in catch block for GitHub auth ([7964104](https://github.com/deploystackio/deploystack/commit/79641044c4120d7242bdb85ba440adbdf0a5b818))
* update token scopes to include categories read access ([cb2b329](https://github.com/deploystackio/deploystack/commit/cb2b329c591f17cc6cdb025d8deac8981dd47185))
* update API documentation and plugin security features for clarity and consistency ([76ae661](https://github.com/deploystackio/deploystack/commit/76ae661fbef93edc83ad86ffdc8c15cb055a556b))
* update logging section in README with additional details and examples ([b8b6753](https://github.com/deploystackio/deploystack/commit/b8b6753f3f3d895913812c6e9dce742ba8cd8d9e))
* update MCP endpoint in gateway README to reflect new default port ([d3db66c](https://github.com/deploystackio/deploystack/commit/d3db66c2e818498c313c057b8388b04119752b9e))
* update README links for better formatting ([503ec2c](https://github.com/deploystackio/deploystack/commit/503ec2cbef8ee10021ef6f501ffcc0c816278da3))
* update README to reflect completed phases and installation ([0bbf82e](https://github.com/deploystackio/deploystack/commit/0bbf82edf9335ec7ae52794c04757b2df2973a90))
* update README with backup strategies and directory structure ([c56fa6d](https://github.com/deploystackio/deploystack/commit/c56fa6d90a9eb3cf7ad0bbb06c0478c2af0aa79e))
* add change password endpoint for authenticated users ([d482764](https://github.com/deploystackio/deploystack/commit/d4827642f91a83822bfb26404498a115d8b4785e))
* Add configurable version display in root API response based on global setting ([bfbafca](https://github.com/deploystackio/deploystack/commit/bfbafca43b5f41347058db2021dbf7bc3e120563))
* add cross-user permissions tests and update test context structure ([5f35dec](https://github.com/deploystackio/deploystack/commit/5f35dec192ccfa8fcf63a783ade1774e747b9ed6))
* add dashboard view with user data fetching and error handling ([7508baa](https://github.com/deploystackio/deploystack/commit/7508baa6658e0b385612485f1a52896c18a81c19))
* add endpoint to retrieve current user's default team ([8826273](https://github.com/deploystackio/deploystack/commit/8826273ff1887432fd5318b07e2388fb513391fc))
* add forgot password and reset password functionality with corresponding routes and localization ([2955345](https://github.com/deploystackio/deploystack/commit/2955345b526877ecac11a4ceba8882598a709398))
* Add health check endpoint for API status monitoring ([bdbb7ec](https://github.com/deploystackio/deploystack/commit/bdbb7ec2609c5d1ddd1ace735e128db87debc3ce))
* add installation details and environment variables components ([194c285](https://github.com/deploystackio/deploystack/commit/194c285200c30d6f378814eeec4b47502e6bd498))
* add setup success message to Setup view and update translations, remove unused imports in Users view ([81687cf](https://github.com/deploystackio/deploystack/commit/81687cfb683ee7e1d1145736916ce4f47d57eca9))
* add SMTP settings component with email testing functionality ([08c24d4](https://github.com/deploystackio/deploystack/commit/08c24d46f1c01b5da7db097711dac211041dc1aa))
* add table component suite with header, body, footer, and cell support ([82a9061](https://github.com/deploystackio/deploystack/commit/82a90613d387695da1b01efe07aa78dbe5be3649))
* add team and team membership functionality ([785fcb0](https://github.com/deploystackio/deploystack/commit/785fcb07e4a1aba7f2e00b2886512382021b9fc1))
* add user detail view and navigation from users list ([9c38eb7](https://github.com/deploystackio/deploystack/commit/9c38eb7e35ec02ed4dcd3a7b5c49647162820a48))
* add user teams management in UserDetail.vue and implement related API tests ([736bef3](https://github.com/deploystackio/deploystack/commit/736bef398749fc67637e49244deda4dcf0c215d2))
* centralize role permissions management and synchronize with database ([bf5fd16](https://github.com/deploystackio/deploystack/commit/bf5fd16b33dd5879cf8b0e0f0005b06ded43db2a))
* Enhance API documentation and response schemas for GitHub auth, global settings, and roles ([5d18255](https://github.com/deploystackio/deploystack/commit/5d1825509042261680f69a351f965dde7008a784))
* enhance backend and frontend release workflows with app token and cleanup branch automation ([7fa54bd](https://github.com/deploystackio/deploystack/commit/7fa54bded5aa98f0e4ce7ac1e9483e3dba75608b))
* Enhance credential management by implementing team-based credential retrieval and success message handling ([99a9b97](https://github.com/deploystackio/deploystack/commit/99a9b976de05d3dc0d04975796f4a724ba254207))
* Enhance credentials search functionality with manual search button ([58eaa38](https://github.com/deploystackio/deploystack/commit/58eaa38338ba0402b7a948106e626b9f2e6f2933))
* enhance global settings handling with proper type conversion for boolean and number values ([5b39887](https://github.com/deploystackio/deploystack/commit/5b398875d73e0b111f8b760fd500ee3439a4f772))
* Enhance MCP Server Catalog with GitHub integration and pagination ([d3c7cb4](https://github.com/deploystackio/deploystack/commit/d3c7cb49de8b998b86b6e2f2d9e94922202fff85))
* enhance user detail view with internationalization support and improved layout ([529a2dc](https://github.com/deploystackio/deploystack/commit/529a2dca9e0fc260ce0aaacd814b5ba2d82d5241))
* Enhance user teams retrieval by including roles and membership details ([2df04ee](https://github.com/deploystackio/deploystack/commit/2df04ee1ac3ea6c95b3ba819b992cfa97f4f7335))
* Enhance users API with detailed response schemas and OpenAPI documentation ([a5eeb7b](https://github.com/deploystackio/deploystack/commit/a5eeb7ba4b8593a7fba88d000f39659627da7074))
* implement admin-initiated password reset functionality with email notification ([533d767](https://github.com/deploystackio/deploystack/commit/533d767690343a8ba39c0825281f46a522cce282))
* implement alert dialog components and admin password reset functionality ([766d880](https://github.com/deploystackio/deploystack/commit/766d880c7cb0068390b7e05297e2be965c6e622f))
* implement AppSidebar and DashboardLayout components with user and team management features ([a9fbad0](https://github.com/deploystackio/deploystack/commit/a9fbad00b5ddf406253c6b7f342fb73b3afba36d))
* Implement cloud credentials management UI and service integration ([6b82d36](https://github.com/deploystackio/deploystack/commit/6b82d3601ddf57017bdda3220d1b464e5fac7cb4))
* implement email verification system ([cce56a8](https://github.com/deploystackio/deploystack/commit/cce56a85129b1e579c762a1ef8a4a3001afbf518))
* implement logout functionality and enhance session management ([084289e](https://github.com/deploystackio/deploystack/commit/084289e981a5bfe46f5105affecf65f8a7352273))
* Implement MCP Installation Service and related components ([bfc8b50](https://github.com/deploystackio/deploystack/commit/bfc8b50bfc8382ba0af07b88f2b0bde38c0d5d35))
* Implement MCP Server Catalog Management UI ([7ea7899](https://github.com/deploystackio/deploystack/commit/7ea789928a312ea3e3981e921a066ccb40d29453))
* implement password reset functionality with token management and email notifications ([246e277](https://github.com/deploystackio/deploystack/commit/246e277485e2fb43d40122799153486f45ccbcea))
* implement plugin migration functionality and update createPluginTables logic ([f3fd98e](https://github.com/deploystackio/deploystack/commit/f3fd98e22ce1b42206aaf8a1d010dceb646c8ed6))
* implement plugin route structure and registration system for enhanced security and isolation ([c132a50](https://github.com/deploystackio/deploystack/commit/c132a503aa2845d73a36feca2844796f29c0fe29))
* implement plugin support for global settings, allowing plugins to define and manage their own settings and groups ([c91590c](https://github.com/deploystackio/deploystack/commit/c91590cfc8a25397a5c24a5411bf4e25a2ea64a0))
* Implement session management and SSE handling ([d16879a](https://github.com/deploystackio/deploystack/commit/d16879a8b4b9aa55cdb59e99726a513fe75657ca))
* implement smart caching for user and team services to optimize API calls and improve performance on public routes ([69580fb](https://github.com/deploystackio/deploystack/commit/69580fbfaf0f513235ad97ed26e0214f8e7631a3))
* Implement team member management endpoints and schemas ([14106eb](https://github.com/deploystackio/deploystack/commit/14106ebee3c0088f18c24fdb993433a680d90cd8))
* implement team selection event handling and UI updates in Teams and AppSidebar components ([87a5b79](https://github.com/deploystackio/deploystack/commit/87a5b79b7f8543644664045ed1a06ab86125e467))
* Implement user preferences management system ([73361ef](https://github.com/deploystackio/deploystack/commit/73361efabbf92cf00cc84a5172e164a10d9c786a))
* Implement version management by creating version.ts and updating Dockerfile, workflows, and banner to use dynamic versioning ([e5aeb67](https://github.com/deploystackio/deploystack/commit/e5aeb674d752959b6bb06ecbbbd206be71099bf8))
* refactor database schema management by consolidating schema definitions and removing legacy schema file ([516b7a9](https://github.com/deploystackio/deploystack/commit/516b7a9551f152f4824c00a4e8219add7199d6f8))
* Refactor MCP server catalog forms and add Claude Desktop configuration step ([1560b69](https://github.com/deploystackio/deploystack/commit/1560b699d00ffa4eedcbc9c434d1534e39097849))
* Refactor MCP server selection step to use McpServerCard component for better modularity ([d73fbd1](https://github.com/deploystackio/deploystack/commit/d73fbd1dee120b5af3f1a7bbaf80b15ebfb84942))
* Refactor team management table by creating a dedicated component and enhancing search functionality ([4589ee4](https://github.com/deploystackio/deploystack/commit/4589ee4e498b92c701667f5cf9b65643159dbdf7))
* replace dynamic schema generation with static schema import and enhance session validation logic ([16edafa](https://github.com/deploystackio/deploystack/commit/16edafaad0ff75db0182420cf87e3be730321291))
* streamline user registration by removing manual session creation and simplifying response handling ([a215419](https://github.com/deploystackio/deploystack/commit/a2154197cf41cab0fd9b94b4cb374b46628661a7))
* Update API endpoints in user and cloud credentials tests to include '/api' prefix for consistency ([e59f3b0](https://github.com/deploystackio/deploystack/commit/e59f3b0d6e7cd028afd49e19a4a03c6918dee1fd))
* Update API routes to use preValidation instead of preHandler for global admin checks ([ce81827](https://github.com/deploystackio/deploystack/commit/ce8182788bcc1b07f2a2ae6ac3df7f01dc4a3e44))
* update database schema tests to use static schema module and remove unused imports ([acf8caa](https://github.com/deploystackio/deploystack/commit/acf8caadfd10b1dcaaf78a41fdb15203e8c0f190))
* Update table headers to improve styling and consistency across components ([8a5e560](https://github.com/deploystackio/deploystack/commit/8a5e560afab0dd347a63fdae8019edc9bb3cc74f))
* implement scoped commit message guidelines and templates ([908b262](https://github.com/deploystackio/deploystack/commit/908b262f76456abbddfc8a5e72f9f02c9da0f59a))
* update README with new links and SVG assets ([e62ef11](https://github.com/deploystackio/deploystack/commit/e62ef112df4d0240a633556a835475946cda65eb))
* add configurable team member limit and update error messages ([6544193](https://github.com/deploystackio/deploystack/commit/6544193b61d9c4ebd8b8055e6dd7e7d4bb9dcc6c))
* add dynamic team creation limit from global settings ([fa5a3ca](https://github.com/deploystackio/deploystack/commit/fa5a3cad07714054f256d548baaea447d7fb5de2))
* add endpoint to send test email and validate SMTP configuration ([273d325](https://github.com/deploystackio/deploystack/commit/273d32502262d0eb00ef3e9bd69034f3130fa0ab))
* add OAuth2 UserInfo endpoint for user information retrieval ([ff97ec0](https://github.com/deploystackio/deploystack/commit/ff97ec048b24de7a55d673420cd8a0968a364eaa))
* add permission check for gateway configuration routes ([f069cbe](https://github.com/deploystackio/deploystack/commit/f069cbe602f566f3780db75be1e58e02a4d79302))
* add response type validation in OAuth2 authorization ([696316c](https://github.com/deploystackio/deploystack/commit/696316c2694a5f41e9a6b34c8021d415fc9967e6))
* add test email functionality and update support email address ([9b52c0a](https://github.com/deploystackio/deploystack/commit/9b52c0ae631a9a0e5655d0d9eb3e9a7cc8ffb456))
* add userinfo route and extend token expiration to 1 week ([40e88c8](https://github.com/deploystackio/deploystack/commit/40e88c8f55b803a1a4e18893ae5e09a0a8e8dd6a))
* enhance API documentation for authentication methods ([45dd309](https://github.com/deploystackio/deploystack/commit/45dd3097c5673a629184057e9bf77e5e853bdb69))
* enhance API spec with health check and consent details ([f0278a3](https://github.com/deploystackio/deploystack/commit/f0278a3f0126da996fe1e3efb698c4ca4396c264))
* enhance email test endpoint with detailed response schemas ([62ba4c0](https://github.com/deploystackio/deploystack/commit/62ba4c0218a1469b77497ca2c2ab44d6b7082c9e))
* enhance login API response with detailed descriptions ([0786ad2](https://github.com/deploystackio/deploystack/commit/0786ad24e56515e9bc915864d4fad0bc3822ffad))
* enhance SQL statement handling for Turso compatibility ([dff35fe](https://github.com/deploystackio/deploystack/commit/dff35fe8b2ba8fe2bacc23890139f8dd314c67fa))
* Implement OAuth2 consent flow with detailed consent management ([f5295b5](https://github.com/deploystackio/deploystack/commit/f5295b550f85e528414d6ff34be24380f82a6815))
* implement welcome email functionality for new users ([39a32eb](https://github.com/deploystackio/deploystack/commit/39a32ebc4484f1560e929c92d7d816123b93d905))
* re-implement team management routes for CRUD operations ([f5420cc](https://github.com/deploystackio/deploystack/commit/f5420cc92cb42a9d42b772bc091f917165aca6d2))
* skip OAuth scope validation for cookie-based authentication ([5f59c5e](https://github.com/deploystackio/deploystack/commit/5f59c5ea4cf191b9f56be1ff11e6452b691147a4))
* update cloud credential tests for GCP provider ([2421487](https://github.com/deploystackio/deploystack/commit/242148709bf0e8e05f45c2bc85d87ee4d3b504df))
* Add comprehensive tests for health route including registration, response validation, and error handling ([42451a6](https://github.com/deploystackio/deploystack/commit/42451a6df34408b40554d1bff4a54d0a7165917c))
* refactor console logging in deleteDbConfig tests for clarity and consistency ([85b7a13](https://github.com/deploystackio/deploystack/commit/85b7a13fad6272bc14182c17064c638ff26c6217))
* enhance email service tests with logging parameters ([8db15b8](https://github.com/deploystackio/deploystack/commit/8db15b8a59feb71698c779a8baeab20da769c87d))
* enhance button cursor styles and remove test environment display from login component ([935f5e4](https://github.com/deploystackio/deploystack/commit/935f5e4bcb9ec1add4e9f208e1b51430d09a92fd))
* update email templates and frontend components for consistency ([f446a1e](https://github.com/deploystackio/deploystack/commit/f446a1e0bb38a21aa3a64ffbf9158533f8a4e72c))
* update email templates for consistent button styling ([2d9b3f4](https://github.com/deploystackio/deploystack/commit/2d9b3f4a8c6fb8da802b76560a77279c879277fd))
* update email templates for improved layout and styling ([e69699a](https://github.com/deploystackio/deploystack/commit/e69699a68e87e8a054b9a5068b291efa67db209b))
* remove unnecessary whitespace in registerRoutes function ([fc37c82](https://github.com/deploystackio/deploystack/commit/fc37c82342efe5ef966bb2f89faab8e717158e7d))
* add category display component and update relevant views for category handling ([a5b2d68](https://github.com/deploystackio/deploystack/commit/a5b2d68fa5b87b469773806611e633b26969b4db))
* add DsAlert component with success alert functionality and update navigation to include success parameter ([6d1a6e8](https://github.com/deploystackio/deploystack/commit/6d1a6e843c158a51f15668c2b0afdba50a28020f))
* enhance layout and styling for environment variables in EnvironmentVariableCard component ([5eb4975](https://github.com/deploystackio/deploystack/commit/5eb4975ade8bfde315a5ecb537409769d41c5ea3))
* enhance MCP categories API with security and error handling ([4add8a5](https://github.com/deploystackio/deploystack/commit/4add8a5960d43fecb1bedc0d2ae72ea00eb4fb79))
* enhance placeholder value check in isPlaceholderValue function ([8c4f421](https://github.com/deploystackio/deploystack/commit/8c4f4216e5493d92e7605e13c4c4d37f28518438))
* enhance server selection step with automatic progression and improve localization for server details ([415b243](https://github.com/deploystackio/deploystack/commit/415b243eea7244125b2cf1a7457aadd97fe72742))
* enhance team API and frontend to include user role information and member count ([855ce3a](https://github.com/deploystackio/deploystack/commit/855ce3aadb261860cba140ee7d496acb97246dde))
* enhance team context management and improve UI feedback for team selection ([d7e3d95](https://github.com/deploystackio/deploystack/commit/d7e3d95e53488f53d48b6271fd32119431690aed))
* enhance team creation flow with detailed success and error messages ([5328a5d](https://github.com/deploystackio/deploystack/commit/5328a5d14d92e5b192fc73aab793bc1e282e208d))
* enhance validation logic for required environment variables and improve server selection handling ([cd91ea3](https://github.com/deploystackio/deploystack/commit/cd91ea3bf8ff7e220b2a720b7a4121f20cfc0804))
* implement ProgressBars component for multi-step progress visualization ([36ef1fd](https://github.com/deploystackio/deploystack/commit/36ef1fd89a90db9fa9918cf5acaa3ffbf48d9daa))
* implement server pre-selection in installation wizard and enhance UI with install button ([1090375](https://github.com/deploystackio/deploystack/commit/1090375288ba3b3f63aea3c4f2e2b709e78c54b6))
* improve structure and styling of environment variable cards in EnvironmentVariableCard component ([e5e20ec](https://github.com/deploystackio/deploystack/commit/e5e20ec6da05f1f90706e0986ab454f0db8ff68a))
* integrate ProgressBars component for enhanced multi-step navigation and update localization for progress states ([0d8f1af](https://github.com/deploystackio/deploystack/commit/0d8f1af4381f5d31371a204054bcb2f8be16422c))
* migrate from zod-to-json-schema to zod-openapi for OpenAPI schema generation ([a859239](https://github.com/deploystackio/deploystack/commit/a859239259c42f41536b9e52b5811d67376227ca))
* optimize step position calculations and remove debug logging in MCP server data conversion ([8a7a908](https://github.com/deploystackio/deploystack/commit/8a7a9082f17cae255655495807543581c210354b))
* remove action button from empty credentials state and clean up related text ([15ab960](https://github.com/deploystackio/deploystack/commit/15ab96068d22590064a3de4df1e02b8319c4ecdb))
* remove dashboard navigation and enhance MCP server selection UI with category filter ([388331a](https://github.com/deploystackio/deploystack/commit/388331a26851571a0b9df60b65d93c7005611ba7))
* remove deprecated users table columns and clean up schema definitions ([d109a52](https://github.com/deploystackio/deploystack/commit/d109a5250af39bc16b38ab4ffb0fe505c6811557))
* remove edit view and replace with view functionality for MCP server catalog ([12aae3b](https://github.com/deploystackio/deploystack/commit/12aae3bb7fdd04141310a46ece0460fc4f807cf8))
* remove old team management views and implement new team management structure ([610551a](https://github.com/deploystackio/deploystack/commit/610551ad8025246784e9a7179169c72006bbe424))
* remove unused components and consolidate credential table logic ([9ef9567](https://github.com/deploystackio/deploystack/commit/9ef9567db3108053d4247344a5f5d4c585b870f0))
* remove unused i18n import from Setup.vue ([3314708](https://github.com/deploystackio/deploystack/commit/331470891719a22ae769f8b79de91fc74eab3310))
* Remove unused imports from CredentialDetail and TeamTableColumns components ([03cf15e](https://github.com/deploystackio/deploystack/commit/03cf15efe12fcbde4bb1b8dea391ded6d14975e6))
* remove users table and update database setup for persistence ([a61c4d2](https://github.com/deploystackio/deploystack/commit/a61c4d2622851a83b33e998c2bf67d0d7c6a5baa))
* replace Breadcrumb navigation with ProgressBars component for improved step visualization and interaction ([d9fd0b4](https://github.com/deploystackio/deploystack/commit/d9fd0b44fdd3b4d1001e787f4bf80f92c61bb9dc))
* Replace permission checks with global admin requirement in global settings route ([69bbf7f](https://github.com/deploystackio/deploystack/commit/69bbf7f0db705d3c94f0f088da6f8c1473fe823b))
* reset form data when navigating to previous steps in installation wizard ([5f4882d](https://github.com/deploystackio/deploystack/commit/5f4882daa4c00c78f50f42c5828c767db3dee2cc))
* Simplify error handling in version retrieval and clean up team member addition logic ([1914f1b](https://github.com/deploystackio/deploystack/commit/1914f1bd89be406cbeade02eec024ec7731cf619))
* simplify platform selection component and enhance UI for better user experience ([af20218](https://github.com/deploystackio/deploystack/commit/af20218ab1731837a9b33b4e603c46abb707ff01))
* streamline environment variable handling in EnvironmentVariableCard and EnvironmentVariablesStep components ([d2fdc5a](https://github.com/deploystackio/deploystack/commit/d2fdc5ab90fce0b3b9098ba5633a7788f8a5f9d1))
* streamline installation card layout and enhance empty state UI ([c82ae2e](https://github.com/deploystackio/deploystack/commit/c82ae2ec66940f04eeba0c4c43640c764ec5f38a))
* update error handling to use 'issues' instead of 'errors' in validation responses ([0f2cec1](https://github.com/deploystackio/deploystack/commit/0f2cec1d1c4f167c4c43cd562ccf58eb85b7f174))
* update error handling to use 'issues' instead of 'errors' in validation responses across multiple test files ([5300277](https://github.com/deploystackio/deploystack/commit/5300277fff84da5fe3578086980a2ef92d15c517))
* update installation form data structure and integrate team context initialization ([1bd8e8a](https://github.com/deploystackio/deploystack/commit/1bd8e8ae0a9543e44a02f2cf216f9c0947909993))
* update installation handling and status representation in MCP components ([89f9447](https://github.com/deploystackio/deploystack/commit/89f9447b1278d9f08c68c9ee24ab00ce2154eae9))
* update markdown linting script to exclude specific frontend UI components ([8e89066](https://github.com/deploystackio/deploystack/commit/8e89066e68267757218da23f53ae40cd5c81d671))
* update MCP server search functionality with advanced filters and category handling ([b31e79c](https://github.com/deploystackio/deploystack/commit/b31e79ca38157a5d0e179846fb7888dc72048392))
* update package-lock.json with new dependencies and links for gateway service ([20b1f6c](https://github.com/deploystackio/deploystack/commit/20b1f6ccaa1a4c9a5ae352ae39b67baa91c5daad))
* update parameter schemas to use type-only definitions for consistency ([fe39005](https://github.com/deploystackio/deploystack/commit/fe39005891cd787569e8f08c524b0be5b6f6fd04))
* update routing to redirect users to MCP server instead of dashboard ([840733f](https://github.com/deploystackio/deploystack/commit/840733f676a5067d7523fd2bae939d91c9d8efa4))
* update Switch component styles for improved appearance and consistency ([52fadba](https://github.com/deploystackio/deploystack/commit/52fadba8386b09a701ab969fc060d5d6b5999e76))
* update value type definition to allow multiple types and make tools optional in global server schema ([f2d8541](https://github.com/deploystackio/deploystack/commit/f2d854116024e55245bfc9c4de6c1a3fd3deb57a))
* enhance password reset logging and error handling ([0d0a63f](https://github.com/deploystackio/deploystack/commit/0d0a63f47b30f9064f02419de442f90f23cca19e))
* simplify token handling in TokenService ([c4e376b](https://github.com/deploystackio/deploystack/commit/c4e376b0da8e71c05505f2a1533d842e12e3c025))
*  ([2c8f040](https://github.com/deploystackio/deploystack/commit/2c8f040f2c7e48aba535e550eef6691b8966f317))
*  ([79a5d70](https://github.com/deploystackio/deploystack/commit/79a5d70def99bf3ba68d13425ad75e378b2cf4be))
*  ([1c222e2](https://github.com/deploystackio/deploystack/commit/1c222e28d4e3b771d86d5b017939d6932f4095a3))
*  ([b265d58](https://github.com/deploystackio/deploystack/commit/b265d58950d6979f1d49c43eeef5671aad87f5cf))
*  ([eef90dd](https://github.com/deploystackio/deploystack/commit/eef90dd293e85bad06d37b771bf4af82279b5b2e))
*  ([57cf824](https://github.com/deploystackio/deploystack/commit/57cf824d039bb4e197db615ecac895ded9254518))
*  ([f409ee1](https://github.com/deploystackio/deploystack/commit/f409ee19e1757db85447fbcf5ffcd5258c3d8ea5))
*  ([e43ede6](https://github.com/deploystackio/deploystack/commit/e43ede67ba28bb0948b089c187f3bc928f0825c7))
*  ([05719c3](https://github.com/deploystackio/deploystack/commit/05719c3952f0a5f4f0695e91a02ff9712edc8a8d))
*  ([5ad059f](https://github.com/deploystackio/deploystack/commit/5ad059f77f34997302cd4c7bf16d6b88c2211ade))
*  ([62fc5bc](https://github.com/deploystackio/deploystack/commit/62fc5bc98881afa079b0849c84d53b5ada9fbe76))
*  ([9d161be](https://github.com/deploystackio/deploystack/commit/9d161bee294a0660ae7d8e148ae4f32ef214f10e))
*  ([a43cc84](https://github.com/deploystackio/deploystack/commit/a43cc84d372507e8815e1819f8bbf6d73e47b291))
*  ([1ae96ef](https://github.com/deploystackio/deploystack/commit/1ae96ef4c838ca19f4faf299598f6228b98f9a82))
*  ([cc5f617](https://github.com/deploystackio/deploystack/commit/cc5f617d2a1b2dc3eb278adc3fa888391f048d31))
*  ([ceac956](https://github.com/deploystackio/deploystack/commit/ceac956c46e9b757363965e4e96ce91ea7d6dc28))
*  ([613d480](https://github.com/deploystackio/deploystack/commit/613d480b8bc061e73a471454e7938b5030065f94))
*  ([2e43f29](https://github.com/deploystackio/deploystack/commit/2e43f295b4e0dce655c9d0d5f9a94ce11dfbe0de))
* update environment variable references to use VITE_DEPLOYSTACK_APP_URL ([71da78c](https://github.com/deploystackio/deploystack/commit/71da78c2a5a948894450ed5d98e4a425a3fb21d0))

## 0.29.0 (2025-08-15)

* add missing line breaks in Docker command examples for clarity ([94d1571](https://github.com/deploystackio/deploystack/commit/94d1571970dbb53b5ef5ea570b4bea223f07e0f0))
* add newline to commitPartial format for better readability ([4e36538](https://github.com/deploystackio/deploystack/commit/4e365382552a301a318b10a5f9c39bf4aed805ed))
* add permissions for issues in backend release workflow ([9b100b8](https://github.com/deploystackio/deploystack/commit/9b100b88c7afed44dbae389f27623e2239fa8e14))
* avoid modifying immutable commit object in release-it transform ([4daad29](https://github.com/deploystackio/deploystack/commit/4daad298d6e113826af92db42f3d7511974323e1))
* clean up empty markdown links and remove empty lines from release notes extraction ([e39b183](https://github.com/deploystackio/deploystack/commit/e39b183268d08b6972eb9c225fcf0dde7922d862))
* correct plugin paths configuration for better clarity and maintainability ([bcb334f](https://github.com/deploystackio/deploystack/commit/bcb334f7eda16cae54d85e2c89c857b8b55d6ef7))
* disable eslint rule for explicit any in cloud providers and cloud credentials routes ([5c0eb3b](https://github.com/deploystackio/deploystack/commit/5c0eb3b70422aad22562bd68c6c45fef32af118d))
* enhance error handling for database connection and update error messages ([dbb7c1d](https://github.com/deploystackio/deploystack/commit/dbb7c1d6feddf2810151de8adc2a88bfffa96e7a))
* enhance frontend release workflow with improved dependency installation and build handling ([d9f2fe1](https://github.com/deploystackio/deploystack/commit/d9f2fe176b195999a74c7cf3eb476c95312ecb19))
* enhance release notes extraction in backend release workflow ([8d1be5f](https://github.com/deploystackio/deploystack/commit/8d1be5fee9ff8b47f9caa1422fba755d2f7a9f8c))
* hardcode GitHub repository URL in commit links for changelog ([b018577](https://github.com/deploystackio/deploystack/commit/b0185776aa878c7db22b201060fc89e83cd76dd6))
* improve frontend release workflow with enhanced dependency installation and release notes extraction ([edd0a39](https://github.com/deploystackio/deploystack/commit/edd0a3914d510aaa0106599d9a7f991be30f82f6))
* remove unnecessary empty markdown link cleanup from workflows ([c1054c7](https://github.com/deploystackio/deploystack/commit/c1054c77c82b3c903879ac7076ec0c41186453ef))
* update base URL and enhance fetch requests with session management ([30291cc](https://github.com/deploystackio/deploystack/commit/30291ccdcd4975c7b4ac6ede5972b0491b96b343))
* update conventional changelog plugin configuration for backend and frontend ([82ff531](https://github.com/deploystackio/deploystack/commit/82ff531b801e2a3c785b179809599342e42da534))
* update Docker run command for frontend environment variables ([529c37f](https://github.com/deploystackio/deploystack/commit/529c37f37172cc2b3d4c4f1ed28685796fdb701e))
* update Docker run command to map port 8080 to 80 for frontend ([2d12bad](https://github.com/deploystackio/deploystack/commit/2d12badc5343e2cb02c6e97755595277066c3df4))
* update environment variable display to use variable name instead of index ([1216346](https://github.com/deploystackio/deploystack/commit/12163468c2594dab00c643fe12b3e2f35822ee8f))
* update environment variable names for frontend and backend URLs in Docker commands and CORS configuration ([c0e3ec8](https://github.com/deploystackio/deploystack/commit/c0e3ec843e124a741a37870e52748973842e849e))
* update error handling to include Bad Request status for invalid credentials ([93d5ee7](https://github.com/deploystackio/deploystack/commit/93d5ee7740af465edad517179566ec9c802d7985))
* update ESLint configuration to ignore temporary TypeScript files and remove unused type imports in global settings and plugin manager ([b443bba](https://github.com/deploystackio/deploystack/commit/b443bba8317e95f5461b85430ebcd479aa78207c))
* update favicon.ico for improved branding ([3229465](https://github.com/deploystackio/deploystack/commit/3229465540469e60f4fbe2a83846df921ebae0b4))
* update release notes extraction to reference the correct paths for version and changelog ([2830b80](https://github.com/deploystackio/deploystack/commit/2830b801c4cc875c47595efb7092b2ff9998d31c))
* update release type options to remove 'auto' and set default to 'patch' ([e471253](https://github.com/deploystackio/deploystack/commit/e47125393dff084bc646ea5a44198ee62e9fb2fa))
* update release-it configuration to properly format commit links in changelog ([ea538d9](https://github.com/deploystackio/deploystack/commit/ea538d983a46b69ec0097672a022510e4fb216d6))
* update security documentation to clarify key security dependencies ([f851ba5](https://github.com/deploystackio/deploystack/commit/f851ba5c10a5eb9b124cfca4f89058e0c1db78d8))
* update storage key handling in DatabaseService to use dynamic baseUrl ([0c27b13](https://github.com/deploystackio/deploystack/commit/0c27b138a97968d39c3fee21406adc12dd8e74b9))
* update timestamp creation to use Date object instead of Date.now() in createGroups method ([45d07fa](https://github.com/deploystackio/deploystack/commit/45d07fa984fc8ed0e589aaaa945482856b5aac25))
* use proper URL template variables for commit links in changelog ([dc5c9c5](https://github.com/deploystackio/deploystack/commit/dc5c9c532d7c96c7705ef2e588c692487099e045))
* correct casing in email service imports and routes ([42a145e](https://github.com/deploystackio/deploystack/commit/42a145e62d5dd688fa4cd027edca657c9715a709))
* correct import paths for email routes and services ([1acc16c](https://github.com/deploystackio/deploystack/commit/1acc16cf0af39fc65790e251d28d3f8745cce88d))
* specify error type as unknown in catch blocks ([6563ad1](https://github.com/deploystackio/deploystack/commit/6563ad120eab2c20d27964b0727fc831a04e281e))
* specify error type in catch block for GitHub auth ([7964104](https://github.com/deploystackio/deploystack/commit/79641044c4120d7242bdb85ba440adbdf0a5b818))
* update token scopes to include categories read access ([cb2b329](https://github.com/deploystackio/deploystack/commit/cb2b329c591f17cc6cdb025d8deac8981dd47185))
* update @typescript-eslint/parser to version 8.35.1 and add license information ([f4a2ab8](https://github.com/deploystackio/deploystack/commit/f4a2ab8d15866c490db17174eb88a133f26374aa))
* update @vitest/coverage-v8 dependency to version 3.2.3 ([85d35fa](https://github.com/deploystackio/deploystack/commit/85d35fa8472272966ea9707ca64ef8575e687080))
* update backend version to 0.20.2 and typescript-eslint to 8.33.0 ([24ef17d](https://github.com/deploystackio/deploystack/commit/24ef17dc0c626b4e8f9baf47e4c0a89d103daf97))
* bump @fastify/cors from 8.5.0 to 11.1.0 ([fd81688](https://github.com/deploystackio/deploystack/commit/fd816882654e4872d6722fcccaeccc0b1c80b742))
* bump @libsql/client from 0.14.0 to 0.15.9 ([abcbe01](https://github.com/deploystackio/deploystack/commit/abcbe01ffc8d79087cf6c5d947406a584a7cd5a5))
* bump @libsql/client from 0.15.9 to 0.15.10 ([f7b42a3](https://github.com/deploystackio/deploystack/commit/f7b42a3f8a07352c6333db1d893e98ce466b381a))
* bump @octokit/auth-app from 8.0.1 to 8.0.2 ([e570cd7](https://github.com/deploystackio/deploystack/commit/e570cd7a3fc931828b1ae16d09dce4c377dfa6f3))
* bump @tailwindcss/postcss from 4.1.10 to 4.1.11 ([b4f69a9](https://github.com/deploystackio/deploystack/commit/b4f69a94f1133ed9a83ae4241416fce4d960c0d7))
* bump @tailwindcss/postcss from 4.1.7 to 4.1.8 ([920fac2](https://github.com/deploystackio/deploystack/commit/920fac2bed5db877d313da0e23ffed9d68fc95d7))
* bump @tailwindcss/postcss from 4.1.8 to 4.1.10 ([5a7e8fc](https://github.com/deploystackio/deploystack/commit/5a7e8fce97f62d3dc4049edae3985c50175a1aa5))
* bump @tailwindcss/vite from 4.1.10 to 4.1.11 ([2343d7f](https://github.com/deploystackio/deploystack/commit/2343d7fbce3b614dc9141f05b5238d60cf68ac6c))
* bump @tailwindcss/vite from 4.1.7 to 4.1.8 ([5e9ed8a](https://github.com/deploystackio/deploystack/commit/5e9ed8ac2b3fb126e11720aa7cd512f71f38b60e))
* bump @types/node from 22.15.29 to 24.0.3 ([7ac5170](https://github.com/deploystackio/deploystack/commit/7ac51707ebaf8dc294f5e57e3489a958dc1b85bc))
* bump @types/node from 24.0.10 to 24.0.13 ([18e7601](https://github.com/deploystackio/deploystack/commit/18e7601f92dd2892d736175254b755b4edecc770))
* bump @types/node from 24.0.13 to 24.0.15 ([4d7f6a1](https://github.com/deploystackio/deploystack/commit/4d7f6a1eeb49129c377f89fa9f042b0f06b7d3e9))
* bump @types/node from 24.0.3 to 24.0.7 ([b75678a](https://github.com/deploystackio/deploystack/commit/b75678a61fcad159acc35af1ef7df726ee84ddcc))
* bump @typescript-eslint/eslint-plugin from 8.35.0 to 8.35.1 ([c29b270](https://github.com/deploystackio/deploystack/commit/c29b270ef2dbd142ecf387690705a05a38358351))
* bump @typescript-eslint/eslint-plugin from 8.35.1 to 8.36.0 ([66f29be](https://github.com/deploystackio/deploystack/commit/66f29bee424eb44a342c5ffa285239620467c46e))
* bump @typescript-eslint/parser from 8.32.1 to 8.33.0 ([04fd3c8](https://github.com/deploystackio/deploystack/commit/04fd3c88c842cc4f1a56f5441e3790350cbe61bf))
* bump @typescript-eslint/parser from 8.34.1 to 8.35.0 ([360d00f](https://github.com/deploystackio/deploystack/commit/360d00f0c306c464f56fbd983bd9121e84e16d78))
* bump @typescript-eslint/parser from 8.37.0 to 8.38.0 ([e3cf2f8](https://github.com/deploystackio/deploystack/commit/e3cf2f84feaa9e80b2e9d5d464bed41feb6ffc2e))
* bump @typescript-eslint/parser from 8.38.0 to 8.39.1 ([dc84016](https://github.com/deploystackio/deploystack/commit/dc8401637ec7ccd564ffb5cd9541d9c914432547))
* bump @vitejs/plugin-vue from 5.2.4 to 6.0.0 ([59969d4](https://github.com/deploystackio/deploystack/commit/59969d4aeeea8b6d0c4dcb833ea280fd815d333d))
* bump @vitejs/plugin-vue from 6.0.0 to 6.0.1 ([60dfc78](https://github.com/deploystackio/deploystack/commit/60dfc7875d7afa4a71a6f56ac71f5b422b588bee))
* bump @vue/eslint-config-typescript from 14.5.1 to 14.6.0 ([2cfd83a](https://github.com/deploystackio/deploystack/commit/2cfd83a326771b274eddca16bb19bbf71a48a220))
* bump @vueuse/core from 13.5.0 to 13.6.0 ([602257f](https://github.com/deploystackio/deploystack/commit/602257feafc534c7ea8e2e455e6eac1109d336cc))
* bump argon2 from 0.43.0 to 0.43.1 ([cb29155](https://github.com/deploystackio/deploystack/commit/cb29155798c7696cd90b0d9c61cd2b3723baeb90))
* bump argon2 from 0.43.1 to 0.44.0 ([c4384e9](https://github.com/deploystackio/deploystack/commit/c4384e94193623bd69a7622ba478c3d2a2b9e672))
* bump better-sqlite3 from 12.1.1 to 12.2.0 ([9f7dcd5](https://github.com/deploystackio/deploystack/commit/9f7dcd575ce39ff981c39aa1b269984ae7e2900f))
* bump commander from 12.1.0 to 14.0.0 ([ef42a93](https://github.com/deploystackio/deploystack/commit/ef42a931d01aceabb6e97cf2474b0038cde33ee4))
* bump drizzle-orm from 0.44.1 to 0.44.2 ([c8f9d0f](https://github.com/deploystackio/deploystack/commit/c8f9d0f06ce2e1e15e2412235a20b397b5c79bf4))
* bump drizzle-orm from 0.44.2 to 0.44.3 ([f62c189](https://github.com/deploystackio/deploystack/commit/f62c1898f18db83dd0d5de3c959a7056f5be7f80))
* bump eslint from 9.28.0 to 9.29.0 ([2957728](https://github.com/deploystackio/deploystack/commit/29577289f6f2fcacb6ae79a871b8100b154e1f8b))
* bump eslint from 9.29.0 to 9.30.0 ([6ea09aa](https://github.com/deploystackio/deploystack/commit/6ea09aafd6e4ff73a3fbc237efbc46ab54959ebd))
* bump eslint from 9.30.1 to 9.31.0 ([2d00015](https://github.com/deploystackio/deploystack/commit/2d000150ddbcad323ce1e37cdb6129e2024b37c3))
* bump eslint-plugin-vue from 10.2.0 to 10.3.0 ([c871268](https://github.com/deploystackio/deploystack/commit/c87126845eb333fad990e561476f00fb2a21c434))
* bump eslint-plugin-vue from 10.3.0 to 10.4.0 ([cb522f8](https://github.com/deploystackio/deploystack/commit/cb522f84a733970960f33691e3ea90c163efefb7))
* bump fastify from 5.3.3 to 5.4.0 ([d2516af](https://github.com/deploystackio/deploystack/commit/d2516afce97b1618f670d240a24fde34632dc532))
* bump inquirer from 8.2.6 to 12.9.1 ([91e3f6a](https://github.com/deploystackio/deploystack/commit/91e3f6a7e4ad721d0d0009edb510993f80ec5969))
* bump jest from 30.0.3 to 30.0.4 ([3d8e5cc](https://github.com/deploystackio/deploystack/commit/3d8e5cc043b66fde1fc0f2711498d0b16fda0128))
* bump lucide-vue-next from 0.511.0 to 0.522.0 ([0bbe36c](https://github.com/deploystackio/deploystack/commit/0bbe36ce8e9284a09a592d07d8121ff78b2df12a))
* bump lucide-vue-next from 0.525.0 to 0.539.0 ([fed7846](https://github.com/deploystackio/deploystack/commit/fed78461eee9b1512270e07bf48de3b8f84d5476))
* bump nodemailer from 6.10.1 to 7.0.3 ([3d64c24](https://github.com/deploystackio/deploystack/commit/3d64c2406a76e2ec3ee5d2516ea476f52888aca6))
* bump nodemailer from 7.0.3 to 7.0.4 ([f27d521](https://github.com/deploystackio/deploystack/commit/f27d5216800e88ffed2a91aa686e477c700b5729))
* bump nodemailer from 7.0.4 to 7.0.5 ([48b326d](https://github.com/deploystackio/deploystack/commit/48b326d9a976bb0572ec7f64c1d0779ce1281138))
* bump pinia from 3.0.2 to 3.0.3 ([4ecda4a](https://github.com/deploystackio/deploystack/commit/4ecda4a7f5d9be6b000e2dd0fe7cb0763782a1ae))
* bump pino from 9.7.0 to 9.8.0 ([9b658c9](https://github.com/deploystackio/deploystack/commit/9b658c9b1d20e9f48877eb135bddda145947a548))
* bump pino-pretty from 13.0.0 to 13.1.1 ([72b68da](https://github.com/deploystackio/deploystack/commit/72b68da3d8b884f18d6e62d12e4e4aa1222750a9))
* bump release-it from 19.0.3 to 19.0.4 ([897c63c](https://github.com/deploystackio/deploystack/commit/897c63cbadc407b239da2ea33e40fb9ee684d694))
* bump supertest from 7.1.1 to 7.1.2 ([bc17573](https://github.com/deploystackio/deploystack/commit/bc17573026322485f6728029cb508616331b7650))
* bump supertest from 7.1.2 to 7.1.3 ([7df6824](https://github.com/deploystackio/deploystack/commit/7df682481603c6111c6777bcef7037bad81e20b4))
* bump supertest from 7.1.3 to 7.1.4 ([6299ab3](https://github.com/deploystackio/deploystack/commit/6299ab3d2bfaef995d8dced6fdef23bdff37a839))
* bump tailwind-merge from 3.3.0 to 3.3.1 ([52dc1ff](https://github.com/deploystackio/deploystack/commit/52dc1ffbb8b763c6d4b83fe2ea51cf67c3be142f))
* bump tailwindcss from 4.1.10 to 4.1.11 ([e09ae4f](https://github.com/deploystackio/deploystack/commit/e09ae4fac26c3b9442f2cfa59fe747ccbe366a6c))
* bump ts-jest from 29.3.4 to 29.4.0 ([c299e81](https://github.com/deploystackio/deploystack/commit/c299e81f9b282e0b5d9a20ff88f0813f9c9ae429))
* bump typescript-eslint from 8.33.0 to 8.34.1 ([7066639](https://github.com/deploystackio/deploystack/commit/706663967bc897629f7f421594c20e95eb3e5ac8))
* bump typescript-eslint from 8.34.1 to 8.35.0 ([686ab27](https://github.com/deploystackio/deploystack/commit/686ab2719af1548e662b993f83e8b6ed817e15eb))
* bump typescript-eslint from 8.35.0 to 8.35.1 ([dd92767](https://github.com/deploystackio/deploystack/commit/dd92767e8f4943bcd45f48b8d9d15b29efd6bffe))
* bump typescript-eslint from 8.35.1 to 8.36.0 ([3786ff8](https://github.com/deploystackio/deploystack/commit/3786ff886686e8391c9f432ad395e15fed8c21b0))
* bump typescript-eslint from 8.36.0 to 8.37.0 ([e4c3fb3](https://github.com/deploystackio/deploystack/commit/e4c3fb3fe42fab1c2c2f8f0556bd7e7c0430f924))
* bump typescript-eslint from 8.37.0 to 8.38.0 ([ba3ca5b](https://github.com/deploystackio/deploystack/commit/ba3ca5b3245293699698fdf7cb84736cb62e7039))
* bump uuid from 9.0.1 to 11.1.0 ([6a7e064](https://github.com/deploystackio/deploystack/commit/6a7e0649b3a603186b3e5e3e8d51de433354d7ef))
* bump vee-validate from 4.15.0 to 4.15.1 ([d2ce63e](https://github.com/deploystackio/deploystack/commit/d2ce63eb1c8faba71ff7a9087b8fa47ee11e264d))
* bump vite from 6.3.5 to 7.0.0 ([4531c42](https://github.com/deploystackio/deploystack/commit/4531c422d3d7b361ae366d031279b337d83a3b74))
* bump vite from 7.0.2 to 7.0.4 ([eb9bde5](https://github.com/deploystackio/deploystack/commit/eb9bde5eea42eb19c554990e0e12817e7cf8443e))
* bump vite from 7.0.4 to 7.0.5 ([d51de0c](https://github.com/deploystackio/deploystack/commit/d51de0c0f488886099e1640192cb0776b61e069d))
* bump vite-plugin-vue-devtools from 7.7.7 to 8.0.0 ([3fc1d22](https://github.com/deploystackio/deploystack/commit/3fc1d223951e428aa9c5b888acfbf549a65d37da))
* bump vitest from 2.1.9 to 3.2.3 ([350bdc4](https://github.com/deploystackio/deploystack/commit/350bdc48990fcf302a06d5b4c0ad197dfd7fc904))
* bump vue from 3.5.16 to 3.5.17 ([6ff47ae](https://github.com/deploystackio/deploystack/commit/6ff47ae58d0d12b94f14ded427bef920dc951c7f))
* bump vue from 3.5.17 to 3.5.18 ([97ff56b](https://github.com/deploystackio/deploystack/commit/97ff56b23b8b5895aa9a5717becba1dbe640353a))
* bump vue-i18n from 11.1.10 to 11.1.11 ([34d5417](https://github.com/deploystackio/deploystack/commit/34d54178665d3d9765151634de8ebb68f11a0d7a))
* bump vue-i18n from 11.1.4 to 11.1.5 ([ef10230](https://github.com/deploystackio/deploystack/commit/ef10230a76cba1b16f6f74681768156fffb90e44))
* bump vue-i18n from 11.1.7 to 11.1.9 ([c96cd74](https://github.com/deploystackio/deploystack/commit/c96cd7463cefc958799fea73e577a65f707559a1))
* bump vue-i18n from 11.1.9 to 11.1.10 ([0b278ac](https://github.com/deploystackio/deploystack/commit/0b278ac9219cbf9f3434857619f6a6b3a851b1bd))
* bump vue-tsc from 2.2.10 to 3.0.1 ([b862db9](https://github.com/deploystackio/deploystack/commit/b862db9e6a69e42810547cef9cff24d699da77bd))
* bump vue-tsc from 3.0.1 to 3.0.3 ([6ba75bd](https://github.com/deploystackio/deploystack/commit/6ba75bd3210c117adcd4b253b2e7ac55bb0e41ce))
* bump vue-tsc from 3.0.3 to 3.0.5 ([7fa11a1](https://github.com/deploystackio/deploystack/commit/7fa11a1968d747475c240b800ff5d8a48db4392b))
* bump zod from 3.25.28 to 3.25.36 ([54d38b8](https://github.com/deploystackio/deploystack/commit/54d38b8091ed5f039c4d960061f902cd9e2c1134))
* bump zod from 3.25.49 to 3.25.65 ([b806058](https://github.com/deploystackio/deploystack/commit/b8060585c55f4cf6773b552c0ea0014c10a031b5))
* bump zod from 3.25.67 to 3.25.75 ([87b5322](https://github.com/deploystackio/deploystack/commit/87b5322d86d45e41565f4d73c3035ccefb9acd84))
* bump zod from 3.25.76 to 4.0.5 ([a436cab](https://github.com/deploystackio/deploystack/commit/a436cab82dfce148fa7237da4bfd75bde0997ff9))
* bump zod from 4.0.5 to 4.0.17 ([93b19af](https://github.com/deploystackio/deploystack/commit/93b19afecc31ecc71e15e9bca0154601f0b21721))
* bump zod-openapi from 5.2.0 to 5.3.1 ([30e0b04](https://github.com/deploystackio/deploystack/commit/30e0b04c68606f4b4bbc6805fc5e2c95e0198146))
* bump zod-to-json-schema from 3.24.5 to 3.24.6 ([b1dde4c](https://github.com/deploystackio/deploystack/commit/b1dde4c86e3df9108c2a420749f887f12bcfd7ad))
* remove scoped commit implementation documentation ([57c6b9c](https://github.com/deploystackio/deploystack/commit/57c6b9c969419e23498e4a6dee06c26970ef4b31))
* add paths for backend catalog and dereferenced data ([225c46f](https://github.com/deploystackio/deploystack/commit/225c46f3c94582c9ee26d8683425c35e21c585ea))
* bump @libsql/client in /services/backend ([01e0877](https://github.com/deploystackio/deploystack/commit/01e0877a4f974f22cd7473df29dd6f76025996be))
* bump @types/jest in /services/backend ([516aa27](https://github.com/deploystackio/deploystack/commit/516aa273dd6e34dce84fda1e18d06a1e7e0ae9ce))
* bump drizzle-orm in /services/backend ([c75e00f](https://github.com/deploystackio/deploystack/commit/c75e00ff17255ae6e178f79f49b761400584c6c6))
* bump jest from 29.7.0 to 30.0.0 in /services/backend ([4e5d7fc](https://github.com/deploystackio/deploystack/commit/4e5d7fc53a92e719ba9ba29bda85ecf631098c4f))
* bump zod from 3.25.76 to 4.0.5 in /services/backend ([bd66143](https://github.com/deploystackio/deploystack/commit/bd6614321a80e4ed917ec4e4aa0479f2ac0647c0))
* improve logging structure for error handling ([7e9fae2](https://github.com/deploystackio/deploystack/commit/7e9fae2ebbaf793e148843aed4bea37f3ee80e72))
* release v0.20.0 ([deef84f](https://github.com/deploystackio/deploystack/commit/deef84fca2a689b3661dce56640d8bf902fb9102))
* release v0.20.1 ([82b34e8](https://github.com/deploystackio/deploystack/commit/82b34e87b46dcd293d537702b3295ba72679d44e))
* release v0.20.2 ([33d5026](https://github.com/deploystackio/deploystack/commit/33d5026d3a0d5f59f7f535174898b9e6a57997b5))
* release v0.20.3 ([c9ca248](https://github.com/deploystackio/deploystack/commit/c9ca2488f668892b2875cedf4a583dfde7db1c03))
* release v0.20.4 ([22d5b1d](https://github.com/deploystackio/deploystack/commit/22d5b1d7af821c56ba034ed465ed50c5932f2951))
* release v0.20.5 ([1c55060](https://github.com/deploystackio/deploystack/commit/1c550601586bb0d514a38d35da4cd9e5389c9cf9))
* release v0.20.6 ([c6e8cbb](https://github.com/deploystackio/deploystack/commit/c6e8cbb410e61d58e3db3231612b8733e3f1d7ce))
* release v0.20.7 ([4f3b4b9](https://github.com/deploystackio/deploystack/commit/4f3b4b9893381e48d7d3314a20d2f6a5f0b5d773))
* release v0.20.8 ([504a74c](https://github.com/deploystackio/deploystack/commit/504a74c18c10a393e107a7a64f855041aef4b14a))
* release v0.20.9 ([890d417](https://github.com/deploystackio/deploystack/commit/890d4174c766a9783571e6e6935a25cce0c37fac))
* release v0.21.0 ([c3ca83c](https://github.com/deploystackio/deploystack/commit/c3ca83c6cab1d2b094d9217950381e7f71945ebd))
* release v0.21.1 ([0ad5fee](https://github.com/deploystackio/deploystack/commit/0ad5fee6e66c4eea3eaabf0f318e69e8f0bcc9e1))
* release v0.22.0 ([1969cd0](https://github.com/deploystackio/deploystack/commit/1969cd000655747b72647e0e8cedffcbc6ab3de8))
* release v0.22.1 ([5e6e2be](https://github.com/deploystackio/deploystack/commit/5e6e2be230ec68806f4d4bd797551b9f1806c86e))
* release v0.23.0 ([9fa9207](https://github.com/deploystackio/deploystack/commit/9fa92073ef3f8c27a94987243f8141a43017bf8b))
* release v0.23.1 ([4ff8148](https://github.com/deploystackio/deploystack/commit/4ff8148787bbdfd6ca0a1c41eebb8cfdce6d4357))
* release v0.24.0 ([7014acd](https://github.com/deploystackio/deploystack/commit/7014acdca257178fd3f534d31b966db51a3b57c5))
* release v0.24.1 ([c876c83](https://github.com/deploystackio/deploystack/commit/c876c837c75ef004632c6a1ed66914df7b32b961))
* release v0.25.0 ([16833e4](https://github.com/deploystackio/deploystack/commit/16833e4e076c65e5aee266e4ae60ac068ae240ff))
* release v0.25.1 ([5e66dce](https://github.com/deploystackio/deploystack/commit/5e66dcede58059fef26951ee3ba498de074f4016))
* release v0.26.0 ([5ca4e67](https://github.com/deploystackio/deploystack/commit/5ca4e6731761ac0b1b68310e17c2ae88cb9bc7ba))
* release v0.26.1 ([15d8719](https://github.com/deploystackio/deploystack/commit/15d8719aa33185ce94784b8a96705dd7ad4f1a8a))
* release v0.27.0 ([7bba1ef](https://github.com/deploystackio/deploystack/commit/7bba1efd3e0aa3aba26c7d83f4368992e4aba317))
* release v0.27.1 ([7f19fb9](https://github.com/deploystackio/deploystack/commit/7f19fb935461571c8cdf835b169d7be0e670a82f))
* release v0.28.0 ([842f14c](https://github.com/deploystackio/deploystack/commit/842f14c45694174eb671e832a03a9b6c8fa4a685))
* release v0.28.1 ([d0013f7](https://github.com/deploystackio/deploystack/commit/d0013f755ec6417a8cdc18fd846fbdc9012fcae3))
* release v0.28.2 ([1eea8d4](https://github.com/deploystackio/deploystack/commit/1eea8d4aaee0993b61f8b4441399277d593350bc))
* release v0.28.3 ([adf8120](https://github.com/deploystackio/deploystack/commit/adf8120a3182f1ab7d88375625ab76c721c0ab6a))
* update environment configuration and README for Docker ([5ab8d49](https://github.com/deploystackio/deploystack/commit/5ab8d496ad0c95a7e16a62c3c012b22b1ca9bf51))
* update rootDir in tsconfig.json to 'src' ([0d58329](https://github.com/deploystackio/deploystack/commit/0d58329cbe5c16decc7869157aadf643fae2dc9e))
* update API documentation and plugin security features for clarity and consistency ([76ae661](https://github.com/deploystackio/deploystack/commit/76ae661fbef93edc83ad86ffdc8c15cb055a556b))
* update logging section in README with additional details and examples ([b8b6753](https://github.com/deploystackio/deploystack/commit/b8b6753f3f3d895913812c6e9dce742ba8cd8d9e))
* update MCP endpoint in gateway README to reflect new default port ([d3db66c](https://github.com/deploystackio/deploystack/commit/d3db66c2e818498c313c057b8388b04119752b9e))
* update README links for better formatting ([503ec2c](https://github.com/deploystackio/deploystack/commit/503ec2cbef8ee10021ef6f501ffcc0c816278da3))
* update README to reflect completed phases and installation ([0bbf82e](https://github.com/deploystackio/deploystack/commit/0bbf82edf9335ec7ae52794c04757b2df2973a90))
* update README with backup strategies and directory structure ([c56fa6d](https://github.com/deploystackio/deploystack/commit/c56fa6d90a9eb3cf7ad0bbb06c0478c2af0aa79e))
* add change password endpoint for authenticated users ([d482764](https://github.com/deploystackio/deploystack/commit/d4827642f91a83822bfb26404498a115d8b4785e))
* Add configurable version display in root API response based on global setting ([bfbafca](https://github.com/deploystackio/deploystack/commit/bfbafca43b5f41347058db2021dbf7bc3e120563))
* add cross-user permissions tests and update test context structure ([5f35dec](https://github.com/deploystackio/deploystack/commit/5f35dec192ccfa8fcf63a783ade1774e747b9ed6))
* add dashboard view with user data fetching and error handling ([7508baa](https://github.com/deploystackio/deploystack/commit/7508baa6658e0b385612485f1a52896c18a81c19))
* add endpoint to retrieve current user's default team ([8826273](https://github.com/deploystackio/deploystack/commit/8826273ff1887432fd5318b07e2388fb513391fc))
* add forgot password and reset password functionality with corresponding routes and localization ([2955345](https://github.com/deploystackio/deploystack/commit/2955345b526877ecac11a4ceba8882598a709398))
* Add health check endpoint for API status monitoring ([bdbb7ec](https://github.com/deploystackio/deploystack/commit/bdbb7ec2609c5d1ddd1ace735e128db87debc3ce))
* add installation details and environment variables components ([194c285](https://github.com/deploystackio/deploystack/commit/194c285200c30d6f378814eeec4b47502e6bd498))
* add setup success message to Setup view and update translations, remove unused imports in Users view ([81687cf](https://github.com/deploystackio/deploystack/commit/81687cfb683ee7e1d1145736916ce4f47d57eca9))
* add SMTP settings component with email testing functionality ([08c24d4](https://github.com/deploystackio/deploystack/commit/08c24d46f1c01b5da7db097711dac211041dc1aa))
* add table component suite with header, body, footer, and cell support ([82a9061](https://github.com/deploystackio/deploystack/commit/82a90613d387695da1b01efe07aa78dbe5be3649))
* add team and team membership functionality ([785fcb0](https://github.com/deploystackio/deploystack/commit/785fcb07e4a1aba7f2e00b2886512382021b9fc1))
* add user detail view and navigation from users list ([9c38eb7](https://github.com/deploystackio/deploystack/commit/9c38eb7e35ec02ed4dcd3a7b5c49647162820a48))
* add user teams management in UserDetail.vue and implement related API tests ([736bef3](https://github.com/deploystackio/deploystack/commit/736bef398749fc67637e49244deda4dcf0c215d2))
* centralize role permissions management and synchronize with database ([bf5fd16](https://github.com/deploystackio/deploystack/commit/bf5fd16b33dd5879cf8b0e0f0005b06ded43db2a))
* Enhance API documentation and response schemas for GitHub auth, global settings, and roles ([5d18255](https://github.com/deploystackio/deploystack/commit/5d1825509042261680f69a351f965dde7008a784))
* enhance backend and frontend release workflows with app token and cleanup branch automation ([7fa54bd](https://github.com/deploystackio/deploystack/commit/7fa54bded5aa98f0e4ce7ac1e9483e3dba75608b))
* Enhance credential management by implementing team-based credential retrieval and success message handling ([99a9b97](https://github.com/deploystackio/deploystack/commit/99a9b976de05d3dc0d04975796f4a724ba254207))
* Enhance credentials search functionality with manual search button ([58eaa38](https://github.com/deploystackio/deploystack/commit/58eaa38338ba0402b7a948106e626b9f2e6f2933))
* enhance global settings handling with proper type conversion for boolean and number values ([5b39887](https://github.com/deploystackio/deploystack/commit/5b398875d73e0b111f8b760fd500ee3439a4f772))
* Enhance MCP Server Catalog with GitHub integration and pagination ([d3c7cb4](https://github.com/deploystackio/deploystack/commit/d3c7cb49de8b998b86b6e2f2d9e94922202fff85))
* enhance user detail view with internationalization support and improved layout ([529a2dc](https://github.com/deploystackio/deploystack/commit/529a2dca9e0fc260ce0aaacd814b5ba2d82d5241))
* Enhance user teams retrieval by including roles and membership details ([2df04ee](https://github.com/deploystackio/deploystack/commit/2df04ee1ac3ea6c95b3ba819b992cfa97f4f7335))
* Enhance users API with detailed response schemas and OpenAPI documentation ([a5eeb7b](https://github.com/deploystackio/deploystack/commit/a5eeb7ba4b8593a7fba88d000f39659627da7074))
* implement admin-initiated password reset functionality with email notification ([533d767](https://github.com/deploystackio/deploystack/commit/533d767690343a8ba39c0825281f46a522cce282))
* implement alert dialog components and admin password reset functionality ([766d880](https://github.com/deploystackio/deploystack/commit/766d880c7cb0068390b7e05297e2be965c6e622f))
* implement AppSidebar and DashboardLayout components with user and team management features ([a9fbad0](https://github.com/deploystackio/deploystack/commit/a9fbad00b5ddf406253c6b7f342fb73b3afba36d))
* Implement cloud credentials management UI and service integration ([6b82d36](https://github.com/deploystackio/deploystack/commit/6b82d3601ddf57017bdda3220d1b464e5fac7cb4))
* implement email verification system ([cce56a8](https://github.com/deploystackio/deploystack/commit/cce56a85129b1e579c762a1ef8a4a3001afbf518))
* implement logout functionality and enhance session management ([084289e](https://github.com/deploystackio/deploystack/commit/084289e981a5bfe46f5105affecf65f8a7352273))
* Implement MCP Installation Service and related components ([bfc8b50](https://github.com/deploystackio/deploystack/commit/bfc8b50bfc8382ba0af07b88f2b0bde38c0d5d35))
* Implement MCP Server Catalog Management UI ([7ea7899](https://github.com/deploystackio/deploystack/commit/7ea789928a312ea3e3981e921a066ccb40d29453))
* implement password reset functionality with token management and email notifications ([246e277](https://github.com/deploystackio/deploystack/commit/246e277485e2fb43d40122799153486f45ccbcea))
* implement plugin migration functionality and update createPluginTables logic ([f3fd98e](https://github.com/deploystackio/deploystack/commit/f3fd98e22ce1b42206aaf8a1d010dceb646c8ed6))
* implement plugin route structure and registration system for enhanced security and isolation ([c132a50](https://github.com/deploystackio/deploystack/commit/c132a503aa2845d73a36feca2844796f29c0fe29))
* implement plugin support for global settings, allowing plugins to define and manage their own settings and groups ([c91590c](https://github.com/deploystackio/deploystack/commit/c91590cfc8a25397a5c24a5411bf4e25a2ea64a0))
* Implement session management and SSE handling ([d16879a](https://github.com/deploystackio/deploystack/commit/d16879a8b4b9aa55cdb59e99726a513fe75657ca))
* implement smart caching for user and team services to optimize API calls and improve performance on public routes ([69580fb](https://github.com/deploystackio/deploystack/commit/69580fbfaf0f513235ad97ed26e0214f8e7631a3))
* Implement team member management endpoints and schemas ([14106eb](https://github.com/deploystackio/deploystack/commit/14106ebee3c0088f18c24fdb993433a680d90cd8))
* implement team selection event handling and UI updates in Teams and AppSidebar components ([87a5b79](https://github.com/deploystackio/deploystack/commit/87a5b79b7f8543644664045ed1a06ab86125e467))
* Implement user preferences management system ([73361ef](https://github.com/deploystackio/deploystack/commit/73361efabbf92cf00cc84a5172e164a10d9c786a))
* Implement version management by creating version.ts and updating Dockerfile, workflows, and banner to use dynamic versioning ([e5aeb67](https://github.com/deploystackio/deploystack/commit/e5aeb674d752959b6bb06ecbbbd206be71099bf8))
* refactor database schema management by consolidating schema definitions and removing legacy schema file ([516b7a9](https://github.com/deploystackio/deploystack/commit/516b7a9551f152f4824c00a4e8219add7199d6f8))
* Refactor MCP server catalog forms and add Claude Desktop configuration step ([1560b69](https://github.com/deploystackio/deploystack/commit/1560b699d00ffa4eedcbc9c434d1534e39097849))
* Refactor MCP server selection step to use McpServerCard component for better modularity ([d73fbd1](https://github.com/deploystackio/deploystack/commit/d73fbd1dee120b5af3f1a7bbaf80b15ebfb84942))
* Refactor team management table by creating a dedicated component and enhancing search functionality ([4589ee4](https://github.com/deploystackio/deploystack/commit/4589ee4e498b92c701667f5cf9b65643159dbdf7))
* replace dynamic schema generation with static schema import and enhance session validation logic ([16edafa](https://github.com/deploystackio/deploystack/commit/16edafaad0ff75db0182420cf87e3be730321291))
* streamline user registration by removing manual session creation and simplifying response handling ([a215419](https://github.com/deploystackio/deploystack/commit/a2154197cf41cab0fd9b94b4cb374b46628661a7))
* Update API endpoints in user and cloud credentials tests to include '/api' prefix for consistency ([e59f3b0](https://github.com/deploystackio/deploystack/commit/e59f3b0d6e7cd028afd49e19a4a03c6918dee1fd))
* Update API routes to use preValidation instead of preHandler for global admin checks ([ce81827](https://github.com/deploystackio/deploystack/commit/ce8182788bcc1b07f2a2ae6ac3df7f01dc4a3e44))
* update database schema tests to use static schema module and remove unused imports ([acf8caa](https://github.com/deploystackio/deploystack/commit/acf8caadfd10b1dcaaf78a41fdb15203e8c0f190))
* Update table headers to improve styling and consistency across components ([8a5e560](https://github.com/deploystackio/deploystack/commit/8a5e560afab0dd347a63fdae8019edc9bb3cc74f))
* implement scoped commit message guidelines and templates ([908b262](https://github.com/deploystackio/deploystack/commit/908b262f76456abbddfc8a5e72f9f02c9da0f59a))
* update README with new links and SVG assets ([e62ef11](https://github.com/deploystackio/deploystack/commit/e62ef112df4d0240a633556a835475946cda65eb))
* add configurable team member limit and update error messages ([6544193](https://github.com/deploystackio/deploystack/commit/6544193b61d9c4ebd8b8055e6dd7e7d4bb9dcc6c))
* add dynamic team creation limit from global settings ([fa5a3ca](https://github.com/deploystackio/deploystack/commit/fa5a3cad07714054f256d548baaea447d7fb5de2))
* add endpoint to send test email and validate SMTP configuration ([273d325](https://github.com/deploystackio/deploystack/commit/273d32502262d0eb00ef3e9bd69034f3130fa0ab))
* add OAuth2 UserInfo endpoint for user information retrieval ([ff97ec0](https://github.com/deploystackio/deploystack/commit/ff97ec048b24de7a55d673420cd8a0968a364eaa))
* add permission check for gateway configuration routes ([f069cbe](https://github.com/deploystackio/deploystack/commit/f069cbe602f566f3780db75be1e58e02a4d79302))
* add response type validation in OAuth2 authorization ([696316c](https://github.com/deploystackio/deploystack/commit/696316c2694a5f41e9a6b34c8021d415fc9967e6))
* add test email functionality and update support email address ([9b52c0a](https://github.com/deploystackio/deploystack/commit/9b52c0ae631a9a0e5655d0d9eb3e9a7cc8ffb456))
* add userinfo route and extend token expiration to 1 week ([40e88c8](https://github.com/deploystackio/deploystack/commit/40e88c8f55b803a1a4e18893ae5e09a0a8e8dd6a))
* enhance API documentation for authentication methods ([45dd309](https://github.com/deploystackio/deploystack/commit/45dd3097c5673a629184057e9bf77e5e853bdb69))
* enhance API spec with health check and consent details ([f0278a3](https://github.com/deploystackio/deploystack/commit/f0278a3f0126da996fe1e3efb698c4ca4396c264))
* enhance email test endpoint with detailed response schemas ([62ba4c0](https://github.com/deploystackio/deploystack/commit/62ba4c0218a1469b77497ca2c2ab44d6b7082c9e))
* enhance login API response with detailed descriptions ([0786ad2](https://github.com/deploystackio/deploystack/commit/0786ad24e56515e9bc915864d4fad0bc3822ffad))
* enhance SQL statement handling for Turso compatibility ([dff35fe](https://github.com/deploystackio/deploystack/commit/dff35fe8b2ba8fe2bacc23890139f8dd314c67fa))
* Implement OAuth2 consent flow with detailed consent management ([f5295b5](https://github.com/deploystackio/deploystack/commit/f5295b550f85e528414d6ff34be24380f82a6815))
* implement welcome email functionality for new users ([39a32eb](https://github.com/deploystackio/deploystack/commit/39a32ebc4484f1560e929c92d7d816123b93d905))
* re-implement team management routes for CRUD operations ([f5420cc](https://github.com/deploystackio/deploystack/commit/f5420cc92cb42a9d42b772bc091f917165aca6d2))
* skip OAuth scope validation for cookie-based authentication ([5f59c5e](https://github.com/deploystackio/deploystack/commit/5f59c5ea4cf191b9f56be1ff11e6452b691147a4))
* update cloud credential tests for GCP provider ([2421487](https://github.com/deploystackio/deploystack/commit/242148709bf0e8e05f45c2bc85d87ee4d3b504df))
* Add comprehensive tests for health route including registration, response validation, and error handling ([42451a6](https://github.com/deploystackio/deploystack/commit/42451a6df34408b40554d1bff4a54d0a7165917c))
* refactor console logging in deleteDbConfig tests for clarity and consistency ([85b7a13](https://github.com/deploystackio/deploystack/commit/85b7a13fad6272bc14182c17064c638ff26c6217))
* enhance email service tests with logging parameters ([8db15b8](https://github.com/deploystackio/deploystack/commit/8db15b8a59feb71698c779a8baeab20da769c87d))
* enhance button cursor styles and remove test environment display from login component ([935f5e4](https://github.com/deploystackio/deploystack/commit/935f5e4bcb9ec1add4e9f208e1b51430d09a92fd))
* update email templates and frontend components for consistency ([f446a1e](https://github.com/deploystackio/deploystack/commit/f446a1e0bb38a21aa3a64ffbf9158533f8a4e72c))
* update email templates for consistent button styling ([2d9b3f4](https://github.com/deploystackio/deploystack/commit/2d9b3f4a8c6fb8da802b76560a77279c879277fd))
* update email templates for improved layout and styling ([e69699a](https://github.com/deploystackio/deploystack/commit/e69699a68e87e8a054b9a5068b291efa67db209b))
* remove unnecessary whitespace in registerRoutes function ([fc37c82](https://github.com/deploystackio/deploystack/commit/fc37c82342efe5ef966bb2f89faab8e717158e7d))
* add category display component and update relevant views for category handling ([a5b2d68](https://github.com/deploystackio/deploystack/commit/a5b2d68fa5b87b469773806611e633b26969b4db))
* add DsAlert component with success alert functionality and update navigation to include success parameter ([6d1a6e8](https://github.com/deploystackio/deploystack/commit/6d1a6e843c158a51f15668c2b0afdba50a28020f))
* enhance layout and styling for environment variables in EnvironmentVariableCard component ([5eb4975](https://github.com/deploystackio/deploystack/commit/5eb4975ade8bfde315a5ecb537409769d41c5ea3))
* enhance MCP categories API with security and error handling ([4add8a5](https://github.com/deploystackio/deploystack/commit/4add8a5960d43fecb1bedc0d2ae72ea00eb4fb79))
* enhance placeholder value check in isPlaceholderValue function ([8c4f421](https://github.com/deploystackio/deploystack/commit/8c4f4216e5493d92e7605e13c4c4d37f28518438))
* enhance server selection step with automatic progression and improve localization for server details ([415b243](https://github.com/deploystackio/deploystack/commit/415b243eea7244125b2cf1a7457aadd97fe72742))
* enhance team API and frontend to include user role information and member count ([855ce3a](https://github.com/deploystackio/deploystack/commit/855ce3aadb261860cba140ee7d496acb97246dde))
* enhance team context management and improve UI feedback for team selection ([d7e3d95](https://github.com/deploystackio/deploystack/commit/d7e3d95e53488f53d48b6271fd32119431690aed))
* enhance team creation flow with detailed success and error messages ([5328a5d](https://github.com/deploystackio/deploystack/commit/5328a5d14d92e5b192fc73aab793bc1e282e208d))
* enhance validation logic for required environment variables and improve server selection handling ([cd91ea3](https://github.com/deploystackio/deploystack/commit/cd91ea3bf8ff7e220b2a720b7a4121f20cfc0804))
* implement ProgressBars component for multi-step progress visualization ([36ef1fd](https://github.com/deploystackio/deploystack/commit/36ef1fd89a90db9fa9918cf5acaa3ffbf48d9daa))
* implement server pre-selection in installation wizard and enhance UI with install button ([1090375](https://github.com/deploystackio/deploystack/commit/1090375288ba3b3f63aea3c4f2e2b709e78c54b6))
* improve structure and styling of environment variable cards in EnvironmentVariableCard component ([e5e20ec](https://github.com/deploystackio/deploystack/commit/e5e20ec6da05f1f90706e0986ab454f0db8ff68a))
* integrate ProgressBars component for enhanced multi-step navigation and update localization for progress states ([0d8f1af](https://github.com/deploystackio/deploystack/commit/0d8f1af4381f5d31371a204054bcb2f8be16422c))
* migrate from zod-to-json-schema to zod-openapi for OpenAPI schema generation ([a859239](https://github.com/deploystackio/deploystack/commit/a859239259c42f41536b9e52b5811d67376227ca))
* optimize step position calculations and remove debug logging in MCP server data conversion ([8a7a908](https://github.com/deploystackio/deploystack/commit/8a7a9082f17cae255655495807543581c210354b))
* remove action button from empty credentials state and clean up related text ([15ab960](https://github.com/deploystackio/deploystack/commit/15ab96068d22590064a3de4df1e02b8319c4ecdb))
* remove dashboard navigation and enhance MCP server selection UI with category filter ([388331a](https://github.com/deploystackio/deploystack/commit/388331a26851571a0b9df60b65d93c7005611ba7))
* remove deprecated users table columns and clean up schema definitions ([d109a52](https://github.com/deploystackio/deploystack/commit/d109a5250af39bc16b38ab4ffb0fe505c6811557))
* remove edit view and replace with view functionality for MCP server catalog ([12aae3b](https://github.com/deploystackio/deploystack/commit/12aae3bb7fdd04141310a46ece0460fc4f807cf8))
* remove old team management views and implement new team management structure ([610551a](https://github.com/deploystackio/deploystack/commit/610551ad8025246784e9a7179169c72006bbe424))
* remove unused components and consolidate credential table logic ([9ef9567](https://github.com/deploystackio/deploystack/commit/9ef9567db3108053d4247344a5f5d4c585b870f0))
* remove unused i18n import from Setup.vue ([3314708](https://github.com/deploystackio/deploystack/commit/331470891719a22ae769f8b79de91fc74eab3310))
* Remove unused imports from CredentialDetail and TeamTableColumns components ([03cf15e](https://github.com/deploystackio/deploystack/commit/03cf15efe12fcbde4bb1b8dea391ded6d14975e6))
* remove users table and update database setup for persistence ([a61c4d2](https://github.com/deploystackio/deploystack/commit/a61c4d2622851a83b33e998c2bf67d0d7c6a5baa))
* replace Breadcrumb navigation with ProgressBars component for improved step visualization and interaction ([d9fd0b4](https://github.com/deploystackio/deploystack/commit/d9fd0b44fdd3b4d1001e787f4bf80f92c61bb9dc))
* Replace permission checks with global admin requirement in global settings route ([69bbf7f](https://github.com/deploystackio/deploystack/commit/69bbf7f0db705d3c94f0f088da6f8c1473fe823b))
* reset form data when navigating to previous steps in installation wizard ([5f4882d](https://github.com/deploystackio/deploystack/commit/5f4882daa4c00c78f50f42c5828c767db3dee2cc))
* Simplify error handling in version retrieval and clean up team member addition logic ([1914f1b](https://github.com/deploystackio/deploystack/commit/1914f1bd89be406cbeade02eec024ec7731cf619))
* simplify platform selection component and enhance UI for better user experience ([af20218](https://github.com/deploystackio/deploystack/commit/af20218ab1731837a9b33b4e603c46abb707ff01))
* streamline environment variable handling in EnvironmentVariableCard and EnvironmentVariablesStep components ([d2fdc5a](https://github.com/deploystackio/deploystack/commit/d2fdc5ab90fce0b3b9098ba5633a7788f8a5f9d1))
* streamline installation card layout and enhance empty state UI ([c82ae2e](https://github.com/deploystackio/deploystack/commit/c82ae2ec66940f04eeba0c4c43640c764ec5f38a))
* update error handling to use 'issues' instead of 'errors' in validation responses ([0f2cec1](https://github.com/deploystackio/deploystack/commit/0f2cec1d1c4f167c4c43cd562ccf58eb85b7f174))
* update error handling to use 'issues' instead of 'errors' in validation responses across multiple test files ([5300277](https://github.com/deploystackio/deploystack/commit/5300277fff84da5fe3578086980a2ef92d15c517))
* update installation form data structure and integrate team context initialization ([1bd8e8a](https://github.com/deploystackio/deploystack/commit/1bd8e8ae0a9543e44a02f2cf216f9c0947909993))
* update installation handling and status representation in MCP components ([89f9447](https://github.com/deploystackio/deploystack/commit/89f9447b1278d9f08c68c9ee24ab00ce2154eae9))
* update markdown linting script to exclude specific frontend UI components ([8e89066](https://github.com/deploystackio/deploystack/commit/8e89066e68267757218da23f53ae40cd5c81d671))
* update MCP server search functionality with advanced filters and category handling ([b31e79c](https://github.com/deploystackio/deploystack/commit/b31e79ca38157a5d0e179846fb7888dc72048392))
* update package-lock.json with new dependencies and links for gateway service ([20b1f6c](https://github.com/deploystackio/deploystack/commit/20b1f6ccaa1a4c9a5ae352ae39b67baa91c5daad))
* update parameter schemas to use type-only definitions for consistency ([fe39005](https://github.com/deploystackio/deploystack/commit/fe39005891cd787569e8f08c524b0be5b6f6fd04))
* update routing to redirect users to MCP server instead of dashboard ([840733f](https://github.com/deploystackio/deploystack/commit/840733f676a5067d7523fd2bae939d91c9d8efa4))
* update Switch component styles for improved appearance and consistency ([52fadba](https://github.com/deploystackio/deploystack/commit/52fadba8386b09a701ab969fc060d5d6b5999e76))
* update value type definition to allow multiple types and make tools optional in global server schema ([f2d8541](https://github.com/deploystackio/deploystack/commit/f2d854116024e55245bfc9c4de6c1a3fd3deb57a))
* enhance password reset logging and error handling ([0d0a63f](https://github.com/deploystackio/deploystack/commit/0d0a63f47b30f9064f02419de442f90f23cca19e))
* simplify token handling in TokenService ([c4e376b](https://github.com/deploystackio/deploystack/commit/c4e376b0da8e71c05505f2a1533d842e12e3c025))
*  ([2c8f040](https://github.com/deploystackio/deploystack/commit/2c8f040f2c7e48aba535e550eef6691b8966f317))
*  ([79a5d70](https://github.com/deploystackio/deploystack/commit/79a5d70def99bf3ba68d13425ad75e378b2cf4be))
*  ([1c222e2](https://github.com/deploystackio/deploystack/commit/1c222e28d4e3b771d86d5b017939d6932f4095a3))
*  ([b265d58](https://github.com/deploystackio/deploystack/commit/b265d58950d6979f1d49c43eeef5671aad87f5cf))
*  ([eef90dd](https://github.com/deploystackio/deploystack/commit/eef90dd293e85bad06d37b771bf4af82279b5b2e))
*  ([57cf824](https://github.com/deploystackio/deploystack/commit/57cf824d039bb4e197db615ecac895ded9254518))
*  ([f409ee1](https://github.com/deploystackio/deploystack/commit/f409ee19e1757db85447fbcf5ffcd5258c3d8ea5))
*  ([e43ede6](https://github.com/deploystackio/deploystack/commit/e43ede67ba28bb0948b089c187f3bc928f0825c7))
*  ([05719c3](https://github.com/deploystackio/deploystack/commit/05719c3952f0a5f4f0695e91a02ff9712edc8a8d))
*  ([5ad059f](https://github.com/deploystackio/deploystack/commit/5ad059f77f34997302cd4c7bf16d6b88c2211ade))
*  ([62fc5bc](https://github.com/deploystackio/deploystack/commit/62fc5bc98881afa079b0849c84d53b5ada9fbe76))
*  ([9d161be](https://github.com/deploystackio/deploystack/commit/9d161bee294a0660ae7d8e148ae4f32ef214f10e))
*  ([a43cc84](https://github.com/deploystackio/deploystack/commit/a43cc84d372507e8815e1819f8bbf6d73e47b291))
*  ([1ae96ef](https://github.com/deploystackio/deploystack/commit/1ae96ef4c838ca19f4faf299598f6228b98f9a82))
*  ([cc5f617](https://github.com/deploystackio/deploystack/commit/cc5f617d2a1b2dc3eb278adc3fa888391f048d31))
*  ([ceac956](https://github.com/deploystackio/deploystack/commit/ceac956c46e9b757363965e4e96ce91ea7d6dc28))
*  ([613d480](https://github.com/deploystackio/deploystack/commit/613d480b8bc061e73a471454e7938b5030065f94))
*  ([2e43f29](https://github.com/deploystackio/deploystack/commit/2e43f295b4e0dce655c9d0d5f9a94ce11dfbe0de))
* update environment variable references to use VITE_DEPLOYSTACK_APP_URL ([71da78c](https://github.com/deploystackio/deploystack/commit/71da78c2a5a948894450ed5d98e4a425a3fb21d0))

## <small>0.28.3 (2025-08-07)</small>

* release v0.28.2 ([d2c1945](https://github.com/deploystackio/deploystack/commit/d2c19455bf76a85bcb2e2a75215c3b53330b76f7))
* enhance SQL statement handling for Turso compatibility ([98fe23e](https://github.com/deploystackio/deploystack/commit/98fe23ef374d03c9a1724be815e43ae543ea8521))

## <small>0.28.2 (2025-08-07)</small>

* enhance SQL statement handling for Turso compatibility ([98fe23e](https://github.com/deploystackio/deploystack/commit/98fe23ef374d03c9a1724be815e43ae543ea8521))

## <small>0.28.1 (2025-08-07)</small>

* remove scoped commit implementation documentation ([8311fc8](https://github.com/deploystackio/deploystack/commit/8311fc89c5c7c6ca4944c0f7040275e00d5170b9))
* add paths for backend catalog and dereferenced data ([9af5c3e](https://github.com/deploystackio/deploystack/commit/9af5c3e0ec37f85d671ea2c2bbc1b096779b0940))
* release v0.28.0 ([55eed57](https://github.com/deploystackio/deploystack/commit/55eed57cfdee0fb073ebb6ec20c609857a049072))
* Implement session management and SSE handling ([cb58e53](https://github.com/deploystackio/deploystack/commit/cb58e538b8b6927e30c175ed979708aa89170c5c))
* implement scoped commit message guidelines and templates ([a6839b8](https://github.com/deploystackio/deploystack/commit/a6839b880248a35a213cfb44f19ec29c0b9553cc))
* update README with new links and SVG assets ([704799c](https://github.com/deploystackio/deploystack/commit/704799c34ef1d67824b5a1911d14ae148b0f4b15))
* add OAuth2 UserInfo endpoint for user information retrieval ([0493bec](https://github.com/deploystackio/deploystack/commit/0493becac71e16909912e262e90c403a5bbac5ed))
* add response type validation in OAuth2 authorization ([f8b82b1](https://github.com/deploystackio/deploystack/commit/f8b82b1237356d86af1c890a4bb50fcb1e6cc0bd))
* add userinfo route and extend token expiration to 1 week ([2660d2e](https://github.com/deploystackio/deploystack/commit/2660d2e8a2f83ece50ac045c59d862e84519ddac))
* enhance API documentation for authentication methods ([237b590](https://github.com/deploystackio/deploystack/commit/237b59003041e4f6e1a1b8b69a5077786b504f9b))
* enhance API spec with health check and consent details ([56282e9](https://github.com/deploystackio/deploystack/commit/56282e988ecd8a3ec8aab1aa17d51365ed9e4449))
* Implement OAuth2 consent flow with detailed consent management ([a9ae782](https://github.com/deploystackio/deploystack/commit/a9ae7823ff27129f1a5bee54baba2f3bba678998))
* skip OAuth scope validation for cookie-based authentication ([5ffa12c](https://github.com/deploystackio/deploystack/commit/5ffa12cc415e610ae67eb773a44d931b2e3e9d03))
* update cloud credential tests for GCP provider ([666ce2d](https://github.com/deploystackio/deploystack/commit/666ce2d6123077c3a9f5d023d1f8f9134768d0d4))
* update README links for better formatting ([ba15434](https://github.com/deploystackio/deploystack/commit/ba15434bd65f371d9ad39576a56a923a9040f74e))
* remove unnecessary whitespace in registerRoutes function ([1c6dd17](https://github.com/deploystackio/deploystack/commit/1c6dd17dfc9663bfc648e54cc24e698b8a43b2bb))
* simplify token handling in TokenService ([16f177b](https://github.com/deploystackio/deploystack/commit/16f177bf41234554595e7352808e2f87ab9a0d09))

## 0.28.0 (2025-08-07)

* remove scoped commit implementation documentation ([8311fc8](https://github.com/deploystackio/deploystack/commit/8311fc89c5c7c6ca4944c0f7040275e00d5170b9))
* add paths for backend catalog and dereferenced data ([9af5c3e](https://github.com/deploystackio/deploystack/commit/9af5c3e0ec37f85d671ea2c2bbc1b096779b0940))
* Implement session management and SSE handling ([cb58e53](https://github.com/deploystackio/deploystack/commit/cb58e538b8b6927e30c175ed979708aa89170c5c))
* implement scoped commit message guidelines and templates ([a6839b8](https://github.com/deploystackio/deploystack/commit/a6839b880248a35a213cfb44f19ec29c0b9553cc))
* update README with new links and SVG assets ([704799c](https://github.com/deploystackio/deploystack/commit/704799c34ef1d67824b5a1911d14ae148b0f4b15))
* add OAuth2 UserInfo endpoint for user information retrieval ([0493bec](https://github.com/deploystackio/deploystack/commit/0493becac71e16909912e262e90c403a5bbac5ed))
* add response type validation in OAuth2 authorization ([f8b82b1](https://github.com/deploystackio/deploystack/commit/f8b82b1237356d86af1c890a4bb50fcb1e6cc0bd))
* add userinfo route and extend token expiration to 1 week ([2660d2e](https://github.com/deploystackio/deploystack/commit/2660d2e8a2f83ece50ac045c59d862e84519ddac))
* enhance API documentation for authentication methods ([237b590](https://github.com/deploystackio/deploystack/commit/237b59003041e4f6e1a1b8b69a5077786b504f9b))
* enhance API spec with health check and consent details ([56282e9](https://github.com/deploystackio/deploystack/commit/56282e988ecd8a3ec8aab1aa17d51365ed9e4449))
* Implement OAuth2 consent flow with detailed consent management ([a9ae782](https://github.com/deploystackio/deploystack/commit/a9ae7823ff27129f1a5bee54baba2f3bba678998))
* skip OAuth scope validation for cookie-based authentication ([5ffa12c](https://github.com/deploystackio/deploystack/commit/5ffa12cc415e610ae67eb773a44d931b2e3e9d03))
* update cloud credential tests for GCP provider ([666ce2d](https://github.com/deploystackio/deploystack/commit/666ce2d6123077c3a9f5d023d1f8f9134768d0d4))
* update README links for better formatting ([ba15434](https://github.com/deploystackio/deploystack/commit/ba15434bd65f371d9ad39576a56a923a9040f74e))
* remove unnecessary whitespace in registerRoutes function ([1c6dd17](https://github.com/deploystackio/deploystack/commit/1c6dd17dfc9663bfc648e54cc24e698b8a43b2bb))
* simplify token handling in TokenService ([16f177b](https://github.com/deploystackio/deploystack/commit/16f177bf41234554595e7352808e2f87ab9a0d09))

## <small>0.27.1 (2025-07-26)</small>

* bump @libsql/client from 0.15.9 to 0.15.10 ([908efef](https://github.com/deploystackio/deploystack/commit/908efefe920ad03cd859e17c9df9a2e52493e99b))
* bump @types/node from 24.0.13 to 24.0.15 ([8fef45c](https://github.com/deploystackio/deploystack/commit/8fef45c2a932ea2b6842e0b78d72ef5cb2f814e0))
* bump @typescript-eslint/parser from 8.37.0 to 8.38.0 ([8033039](https://github.com/deploystackio/deploystack/commit/80330391f88f488b09b9a64ceb02cfa8950a5c94))
* bump release-it from 19.0.3 to 19.0.4 ([d787cb6](https://github.com/deploystackio/deploystack/commit/d787cb65afb1c10141476a0b1e87243b3dc1aea3))
* bump typescript-eslint from 8.37.0 to 8.38.0 ([7ed34d0](https://github.com/deploystackio/deploystack/commit/7ed34d06c1ffe7764b22ed5e05ebc34deb107a5d))
* bump vite from 7.0.4 to 7.0.5 ([a2bfb72](https://github.com/deploystackio/deploystack/commit/a2bfb72ec0d09d46e100d2145fc6bd3e9e0dc362))
* bump vue-i18n from 11.1.9 to 11.1.10 ([f751909](https://github.com/deploystackio/deploystack/commit/f751909763e10afb9e932655d8757f7881398477))
* bump vue-tsc from 3.0.1 to 3.0.3 ([37052d3](https://github.com/deploystackio/deploystack/commit/37052d3b144ad2ade7b3f1bf4bcdb5fe144af058))
* release v0.27.0 ([948ed10](https://github.com/deploystackio/deploystack/commit/948ed10b3bda94cc28951d623b3904b68f2621b2))
* add installation details and environment variables components ([55c8d53](https://github.com/deploystackio/deploystack/commit/55c8d53aad43e0355182c8a0469b68a36765a872))
* implement plugin migration functionality and update createPluginTables logic ([99ec957](https://github.com/deploystackio/deploystack/commit/99ec9575b865f0e005764097b6d06ae8c043d6ef))
* Refactor MCP server selection step to use McpServerCard component for better modularity ([75fa5c2](https://github.com/deploystackio/deploystack/commit/75fa5c2de15663f1d698665fb15e3ffd850ab3cf))
* update MCP endpoint in gateway README to reflect new default port ([8938a50](https://github.com/deploystackio/deploystack/commit/8938a501f1c16b55754fe93fdd4bdae56e400a9c))
* enhance layout and styling for environment variables in EnvironmentVariableCard component ([e4a68f0](https://github.com/deploystackio/deploystack/commit/e4a68f0c023b3bbbf681569fbb2997024ca2eaa5))
* enhance placeholder value check in isPlaceholderValue function ([1cb9634](https://github.com/deploystackio/deploystack/commit/1cb96341b41d78b1a084bba379023b4e9c64e40e))
* enhance validation logic for required environment variables and improve server selection handling ([37affd3](https://github.com/deploystackio/deploystack/commit/37affd369586711fa350ef4efa663faf1d3cf301))
* improve structure and styling of environment variable cards in EnvironmentVariableCard component ([61d8d34](https://github.com/deploystackio/deploystack/commit/61d8d340c0ad9398c6aa318ed4fffe75914e092b))
* streamline environment variable handling in EnvironmentVariableCard and EnvironmentVariablesStep components ([d3a005a](https://github.com/deploystackio/deploystack/commit/d3a005a310a64745bccbc2876d82b5fea4226897))
* update package-lock.json with new dependencies and links for gateway service ([ee4d2cb](https://github.com/deploystackio/deploystack/commit/ee4d2cb1185a5e03fb6c1cbdb07e771f94cc2b73))

## 0.27.0 (2025-07-26)

* bump @libsql/client from 0.15.9 to 0.15.10 ([908efef](https://github.com/deploystackio/deploystack/commit/908efefe920ad03cd859e17c9df9a2e52493e99b))
* bump @types/node from 24.0.13 to 24.0.15 ([8fef45c](https://github.com/deploystackio/deploystack/commit/8fef45c2a932ea2b6842e0b78d72ef5cb2f814e0))
* bump @typescript-eslint/parser from 8.37.0 to 8.38.0 ([8033039](https://github.com/deploystackio/deploystack/commit/80330391f88f488b09b9a64ceb02cfa8950a5c94))
* bump release-it from 19.0.3 to 19.0.4 ([d787cb6](https://github.com/deploystackio/deploystack/commit/d787cb65afb1c10141476a0b1e87243b3dc1aea3))
* bump typescript-eslint from 8.37.0 to 8.38.0 ([7ed34d0](https://github.com/deploystackio/deploystack/commit/7ed34d06c1ffe7764b22ed5e05ebc34deb107a5d))
* bump vite from 7.0.4 to 7.0.5 ([a2bfb72](https://github.com/deploystackio/deploystack/commit/a2bfb72ec0d09d46e100d2145fc6bd3e9e0dc362))
* bump vue-i18n from 11.1.9 to 11.1.10 ([f751909](https://github.com/deploystackio/deploystack/commit/f751909763e10afb9e932655d8757f7881398477))
* bump vue-tsc from 3.0.1 to 3.0.3 ([37052d3](https://github.com/deploystackio/deploystack/commit/37052d3b144ad2ade7b3f1bf4bcdb5fe144af058))
* add installation details and environment variables components ([55c8d53](https://github.com/deploystackio/deploystack/commit/55c8d53aad43e0355182c8a0469b68a36765a872))
* implement plugin migration functionality and update createPluginTables logic ([99ec957](https://github.com/deploystackio/deploystack/commit/99ec9575b865f0e005764097b6d06ae8c043d6ef))
* Refactor MCP server selection step to use McpServerCard component for better modularity ([75fa5c2](https://github.com/deploystackio/deploystack/commit/75fa5c2de15663f1d698665fb15e3ffd850ab3cf))
* update MCP endpoint in gateway README to reflect new default port ([8938a50](https://github.com/deploystackio/deploystack/commit/8938a501f1c16b55754fe93fdd4bdae56e400a9c))
* enhance layout and styling for environment variables in EnvironmentVariableCard component ([e4a68f0](https://github.com/deploystackio/deploystack/commit/e4a68f0c023b3bbbf681569fbb2997024ca2eaa5))
* enhance placeholder value check in isPlaceholderValue function ([1cb9634](https://github.com/deploystackio/deploystack/commit/1cb96341b41d78b1a084bba379023b4e9c64e40e))
* enhance validation logic for required environment variables and improve server selection handling ([37affd3](https://github.com/deploystackio/deploystack/commit/37affd369586711fa350ef4efa663faf1d3cf301))
* improve structure and styling of environment variable cards in EnvironmentVariableCard component ([61d8d34](https://github.com/deploystackio/deploystack/commit/61d8d340c0ad9398c6aa318ed4fffe75914e092b))
* streamline environment variable handling in EnvironmentVariableCard and EnvironmentVariablesStep components ([d3a005a](https://github.com/deploystackio/deploystack/commit/d3a005a310a64745bccbc2876d82b5fea4226897))
* update package-lock.json with new dependencies and links for gateway service ([ee4d2cb](https://github.com/deploystackio/deploystack/commit/ee4d2cb1185a5e03fb6c1cbdb07e771f94cc2b73))

## <small>0.26.1 (2025-07-20)</small>

* add category display component and update relevant views for category handling ([5ab49b8](https://github.com/deploystackio/deploystack/commit/5ab49b8a80e79de451a6aa74b0fc49b39a59b0f8))
* add DsAlert component with success alert functionality and update navigation to include success parameter ([903cc05](https://github.com/deploystackio/deploystack/commit/903cc058fefbbf2e4fa6c45446c22fd892313442))
* enhance MCP categories API with security and error handling ([0aefaa8](https://github.com/deploystackio/deploystack/commit/0aefaa834fb5456145847309643b04fb7eb9e789))
* enhance server selection step with automatic progression and improve localization for server details ([47dc048](https://github.com/deploystackio/deploystack/commit/47dc048e9e5fdefd04c8192d248a0ec97f0955df))
* enhance team API and frontend to include user role information and member count ([9ad9930](https://github.com/deploystackio/deploystack/commit/9ad993022c62bb9d102386372ade143b68511781))
* enhance team context management and improve UI feedback for team selection ([416695c](https://github.com/deploystackio/deploystack/commit/416695ccc35ec6e5470ef53503e194a05f2062ad))
* enhance team creation flow with detailed success and error messages ([9015e3b](https://github.com/deploystackio/deploystack/commit/9015e3b53be1505c20712dd52049117fdba42b14))
* implement ProgressBars component for multi-step progress visualization ([a12903e](https://github.com/deploystackio/deploystack/commit/a12903e623425a81e3e77c1eadd0d9d615a19e82))
* implement server pre-selection in installation wizard and enhance UI with install button ([8649f03](https://github.com/deploystackio/deploystack/commit/8649f03c52fcbb8bf0066124895f54af679dbf6d))
* integrate ProgressBars component for enhanced multi-step navigation and update localization for progress states ([ab76d13](https://github.com/deploystackio/deploystack/commit/ab76d13b376b4869c5210b923adc8d512b025902))
* optimize step position calculations and remove debug logging in MCP server data conversion ([233e190](https://github.com/deploystackio/deploystack/commit/233e190b3a507aef00809c3b9caa97bcea4b5372))
* remove dashboard navigation and enhance MCP server selection UI with category filter ([c981448](https://github.com/deploystackio/deploystack/commit/c981448f4c6d680f3d8ee453cbcf7ca20fb64494))
* replace Breadcrumb navigation with ProgressBars component for improved step visualization and interaction ([97ccf03](https://github.com/deploystackio/deploystack/commit/97ccf039075fbc4d2e9eed943fe5dfa756ef7755))
* reset form data when navigating to previous steps in installation wizard ([da94e71](https://github.com/deploystackio/deploystack/commit/da94e71e7e2ab7dbca2f1004a80458a1d2214fd7))
* simplify platform selection component and enhance UI for better user experience ([a51b772](https://github.com/deploystackio/deploystack/commit/a51b7729c6cbb7b7b2eeb56b24bfa4a4deeaf985))
* streamline installation card layout and enhance empty state UI ([1b649e5](https://github.com/deploystackio/deploystack/commit/1b649e56ba6b0a1683bf001925a5b01395ddfd25))
* update installation form data structure and integrate team context initialization ([d17d9c2](https://github.com/deploystackio/deploystack/commit/d17d9c243b5b92de01e7eb3ec2e656843383201f))
* update installation handling and status representation in MCP components ([d3ceff2](https://github.com/deploystackio/deploystack/commit/d3ceff28aad6a3943ae51a936423340bbedc5baf))
* update markdown linting script to exclude specific frontend UI components ([cbaaa7e](https://github.com/deploystackio/deploystack/commit/cbaaa7eb434278e10e457c9bc32bd54d5b5bfee5))
* update MCP server search functionality with advanced filters and category handling ([d8026fb](https://github.com/deploystackio/deploystack/commit/d8026fbb42ce57de06aa03ef3dc73d2e66c38643))
* update routing to redirect users to MCP server instead of dashboard ([1a4b2bb](https://github.com/deploystackio/deploystack/commit/1a4b2bb1db6deb4a23ca97f964b87050a14acbd1))
* update Switch component styles for improved appearance and consistency ([b24c75f](https://github.com/deploystackio/deploystack/commit/b24c75f3b988facdc977b77ab28d0b1d058f1154))
* update value type definition to allow multiple types and make tools optional in global server schema ([50165f3](https://github.com/deploystackio/deploystack/commit/50165f3a66d57a54226e7147f4a3c9a0c9a45847))
* release v0.26.0 ([96539e7](https://github.com/deploystackio/deploystack/commit/96539e73aa1db999e85ab71d55bbb661b8873c0d))
*  ([a2e1523](https://github.com/deploystackio/deploystack/commit/a2e1523b20da5cea4655dc766cb3bc5a4a745703))
* add newline to commitPartial format for better readability ([68bdbc8](https://github.com/deploystackio/deploystack/commit/68bdbc85564c1d8ce9731c22446261ca45924e44))

## 0.26.0 (2025-07-20)

* add category display component and update relevant views for category handling ([5ab49b8](https://github.com/deploystackio/deploystack/commit/5ab49b8a80e79de451a6aa74b0fc49b39a59b0f8))
* add DsAlert component with success alert functionality and update navigation to include success parameter ([903cc05](https://github.com/deploystackio/deploystack/commit/903cc058fefbbf2e4fa6c45446c22fd892313442))
* enhance MCP categories API with security and error handling ([0aefaa8](https://github.com/deploystackio/deploystack/commit/0aefaa834fb5456145847309643b04fb7eb9e789))
* enhance server selection step with automatic progression and improve localization for server details ([47dc048](https://github.com/deploystackio/deploystack/commit/47dc048e9e5fdefd04c8192d248a0ec97f0955df))
* enhance team API and frontend to include user role information and member count ([9ad9930](https://github.com/deploystackio/deploystack/commit/9ad993022c62bb9d102386372ade143b68511781))
* enhance team context management and improve UI feedback for team selection ([416695c](https://github.com/deploystackio/deploystack/commit/416695ccc35ec6e5470ef53503e194a05f2062ad))
* enhance team creation flow with detailed success and error messages ([9015e3b](https://github.com/deploystackio/deploystack/commit/9015e3b53be1505c20712dd52049117fdba42b14))
* implement ProgressBars component for multi-step progress visualization ([a12903e](https://github.com/deploystackio/deploystack/commit/a12903e623425a81e3e77c1eadd0d9d615a19e82))
* implement server pre-selection in installation wizard and enhance UI with install button ([8649f03](https://github.com/deploystackio/deploystack/commit/8649f03c52fcbb8bf0066124895f54af679dbf6d))
* integrate ProgressBars component for enhanced multi-step navigation and update localization for progress states ([ab76d13](https://github.com/deploystackio/deploystack/commit/ab76d13b376b4869c5210b923adc8d512b025902))
* optimize step position calculations and remove debug logging in MCP server data conversion ([233e190](https://github.com/deploystackio/deploystack/commit/233e190b3a507aef00809c3b9caa97bcea4b5372))
* remove dashboard navigation and enhance MCP server selection UI with category filter ([c981448](https://github.com/deploystackio/deploystack/commit/c981448f4c6d680f3d8ee453cbcf7ca20fb64494))
* replace Breadcrumb navigation with ProgressBars component for improved step visualization and interaction ([97ccf03](https://github.com/deploystackio/deploystack/commit/97ccf039075fbc4d2e9eed943fe5dfa756ef7755))
* reset form data when navigating to previous steps in installation wizard ([da94e71](https://github.com/deploystackio/deploystack/commit/da94e71e7e2ab7dbca2f1004a80458a1d2214fd7))
* simplify platform selection component and enhance UI for better user experience ([a51b772](https://github.com/deploystackio/deploystack/commit/a51b7729c6cbb7b7b2eeb56b24bfa4a4deeaf985))
* streamline installation card layout and enhance empty state UI ([1b649e5](https://github.com/deploystackio/deploystack/commit/1b649e56ba6b0a1683bf001925a5b01395ddfd25))
* update installation form data structure and integrate team context initialization ([d17d9c2](https://github.com/deploystackio/deploystack/commit/d17d9c243b5b92de01e7eb3ec2e656843383201f))
* update installation handling and status representation in MCP components ([d3ceff2](https://github.com/deploystackio/deploystack/commit/d3ceff28aad6a3943ae51a936423340bbedc5baf))
* update MCP server search functionality with advanced filters and category handling ([d8026fb](https://github.com/deploystackio/deploystack/commit/d8026fbb42ce57de06aa03ef3dc73d2e66c38643))
* update routing to redirect users to MCP server instead of dashboard ([1a4b2bb](https://github.com/deploystackio/deploystack/commit/1a4b2bb1db6deb4a23ca97f964b87050a14acbd1))
* update Switch component styles for improved appearance and consistency ([b24c75f](https://github.com/deploystackio/deploystack/commit/b24c75f3b988facdc977b77ab28d0b1d058f1154))
* update value type definition to allow multiple types and make tools optional in global server schema ([50165f3](https://github.com/deploystackio/deploystack/commit/50165f3a66d57a54226e7147f4a3c9a0c9a45847))
*  ([a2e1523](https://github.com/deploystackio/deploystack/commit/a2e1523b20da5cea4655dc766cb3bc5a4a745703))
* add newline to commitPartial format for better readability ([68bdbc8](https://github.com/deploystackio/deploystack/commit/68bdbc85564c1d8ce9731c22446261ca45924e44))

## <small>0.25.1 (2025-07-19)</small>

* bump @octokit/auth-app from 8.0.1 to 8.0.2 ([72640ef](https://github.com/deploystackio/deploystack/commit/72640efe94a7b1f1d74cbc76c70345edf478d8c7))* bump @types/node from 24.0.10 to 24.0.13 ([bff998e](https://github.com/deploystackio/deploystack/commit/bff998efeead965b6a5277e182e12e3c2106f746))* bump argon2 from 0.43.0 to 0.43.1 ([ad4f8d3](https://github.com/deploystackio/deploystack/commit/ad4f8d324acefc9f613e9e3bd9e67be1dd95a7f7))* bump drizzle-orm from 0.44.2 to 0.44.3 ([f20663e](https://github.com/deploystackio/deploystack/commit/f20663e3a26864874bdb7bf0268a437a3787a0d2))* bump eslint from 9.30.1 to 9.31.0 ([396aa87](https://github.com/deploystackio/deploystack/commit/396aa87edf3828f17de8662e7ca79ef3ce597348))* bump supertest from 7.1.2 to 7.1.3 ([3db95a9](https://github.com/deploystackio/deploystack/commit/3db95a9824f1d3cde11018f8268cefc14da345b6))* bump typescript-eslint from 8.36.0 to 8.37.0 ([f2d5957](https://github.com/deploystackio/deploystack/commit/f2d5957dd9858cdf9d7fef37ebf6f715aa619881))* bump vite from 7.0.2 to 7.0.4 ([6356b7f](https://github.com/deploystackio/deploystack/commit/6356b7f124a1bc04bea21dc7979f88939dfe5cf5))* bump zod from 3.25.76 to 4.0.5 ([bb08d44](https://github.com/deploystackio/deploystack/commit/bb08d4493a04fb83948303ffa413d9bcdea3dfd6))* bump zod from 3.25.76 to 4.0.5 in /services/backend ([d3deae2](https://github.com/deploystackio/deploystack/commit/d3deae2f05a11e29fb2c9df2059987fcc04ce462))* release v0.25.0 ([2ff8881](https://github.com/deploystackio/deploystack/commit/2ff8881cbb4a77f74c9f678d9059fcc70ee40c16))* migrate from zod-to-json-schema to zod-openapi for OpenAPI schema generation ([9d54576](https://github.com/deploystackio/deploystack/commit/9d54576d8d50e25771aca4f6e302cdd38a2a0b0c))* update error handling to use 'issues' instead of 'errors' in validation responses ([d738027](https://github.com/deploystackio/deploystack/commit/d73802718eeaa9e7dea99aa6ad0eb3754ff58b28))* update error handling to use 'issues' instead of 'errors' in validation responses across multiple test files ([59d467c](https://github.com/deploystackio/deploystack/commit/59d467c9a7033e3676704f7394dad23cf261ea34))* update parameter schemas to use type-only definitions for consistency ([5f0f381](https://github.com/deploystackio/deploystack/commit/5f0f38167a59367a8c312fc5c40c7dca1ed271f8))*  ([6d6543d](https://github.com/deploystackio/deploystack/commit/6d6543de61d1d32aaeb5765d3b73f4fdc8fabdcf))*  ([f71892e](https://github.com/deploystackio/deploystack/commit/f71892e61ccedbbb22f739fb9434dcf0ba3b06b3))* Implement MCP Installation Service and related components ([c88481f](https://github.com/deploystackio/deploystack/commit/c88481fd7e01a005169e0052e49ee60ba54c641e))* update environment variable display to use variable name instead of index ([df6e47c](https://github.com/deploystackio/deploystack/commit/df6e47ce6d7954254c6c145a1f5a0a7c415ac696))

## 0.25.0 (2025-07-19)

* migrate from zod-to-json-schema to zod-openapi for OpenAPI schema generation ([9d54576](https://github.com/deploystackio/deploystack/commit/9d54576d8d50e25771aca4f6e302cdd38a2a0b0c))* update error handling to use 'issues' instead of 'errors' in validation responses ([d738027](https://github.com/deploystackio/deploystack/commit/d73802718eeaa9e7dea99aa6ad0eb3754ff58b28))* update error handling to use 'issues' instead of 'errors' in validation responses across multiple test files ([59d467c](https://github.com/deploystackio/deploystack/commit/59d467c9a7033e3676704f7394dad23cf261ea34))* update parameter schemas to use type-only definitions for consistency ([5f0f381](https://github.com/deploystackio/deploystack/commit/5f0f38167a59367a8c312fc5c40c7dca1ed271f8))*  ([6d6543d](https://github.com/deploystackio/deploystack/commit/6d6543de61d1d32aaeb5765d3b73f4fdc8fabdcf))*  ([f71892e](https://github.com/deploystackio/deploystack/commit/f71892e61ccedbbb22f739fb9434dcf0ba3b06b3))* Implement MCP Installation Service and related components ([c88481f](https://github.com/deploystackio/deploystack/commit/c88481fd7e01a005169e0052e49ee60ba54c641e))* bump @octokit/auth-app from 8.0.1 to 8.0.2 ([72640ef](https://github.com/deploystackio/deploystack/commit/72640efe94a7b1f1d74cbc76c70345edf478d8c7))* bump @types/node from 24.0.10 to 24.0.13 ([bff998e](https://github.com/deploystackio/deploystack/commit/bff998efeead965b6a5277e182e12e3c2106f746))* bump argon2 from 0.43.0 to 0.43.1 ([ad4f8d3](https://github.com/deploystackio/deploystack/commit/ad4f8d324acefc9f613e9e3bd9e67be1dd95a7f7))* bump drizzle-orm from 0.44.2 to 0.44.3 ([f20663e](https://github.com/deploystackio/deploystack/commit/f20663e3a26864874bdb7bf0268a437a3787a0d2))* bump eslint from 9.30.1 to 9.31.0 ([396aa87](https://github.com/deploystackio/deploystack/commit/396aa87edf3828f17de8662e7ca79ef3ce597348))* bump supertest from 7.1.2 to 7.1.3 ([3db95a9](https://github.com/deploystackio/deploystack/commit/3db95a9824f1d3cde11018f8268cefc14da345b6))* bump typescript-eslint from 8.36.0 to 8.37.0 ([f2d5957](https://github.com/deploystackio/deploystack/commit/f2d5957dd9858cdf9d7fef37ebf6f715aa619881))* bump vite from 7.0.2 to 7.0.4 ([6356b7f](https://github.com/deploystackio/deploystack/commit/6356b7f124a1bc04bea21dc7979f88939dfe5cf5))* bump zod from 3.25.76 to 4.0.5 ([bb08d44](https://github.com/deploystackio/deploystack/commit/bb08d4493a04fb83948303ffa413d9bcdea3dfd6))* bump zod from 3.25.76 to 4.0.5 in /services/backend ([d3deae2](https://github.com/deploystackio/deploystack/commit/d3deae2f05a11e29fb2c9df2059987fcc04ce462))* update environment variable display to use variable name instead of index ([df6e47c](https://github.com/deploystackio/deploystack/commit/df6e47ce6d7954254c6c145a1f5a0a7c415ac696))

## <small>0.24.1 (2025-07-14)</small>

* release v0.24.0 ([c21dcc1](https://github.com/deploystackio/deploystack/commit/c21dcc1fafc4385c7daf05bfb977906722969198))* centralize role permissions management and synchronize with database ([197dd8b](https://github.com/deploystackio/deploystack/commit/197dd8ba4702527329a08516f4f6fade519739c2))* Refactor MCP server catalog forms and add Claude Desktop configuration step ([83579a4](https://github.com/deploystackio/deploystack/commit/83579a45359b08164b68a14a213c52937a3b2032))* remove edit view and replace with view functionality for MCP server catalog ([f5565c1](https://github.com/deploystackio/deploystack/commit/f5565c1f9d06186be0189eaa5dc01da2d6e9c1e7))

## 0.24.0 (2025-07-14)

* centralize role permissions management and synchronize with database ([197dd8b](https://github.com/deploystackio/deploystack/commit/197dd8ba4702527329a08516f4f6fade519739c2))* Refactor MCP server catalog forms and add Claude Desktop configuration step ([83579a4](https://github.com/deploystackio/deploystack/commit/83579a45359b08164b68a14a213c52937a3b2032))* remove edit view and replace with view functionality for MCP server catalog ([f5565c1](https://github.com/deploystackio/deploystack/commit/f5565c1f9d06186be0189eaa5dc01da2d6e9c1e7))

## <small>0.23.1 (2025-07-09)</small>

* bump @libsql/client from 0.14.0 to 0.15.9 ([d6b7275](https://github.com/deploystackio/deploystack/commit/d6b72759c48ae8fdda29f7e534599155db1e8321))* bump @typescript-eslint/eslint-plugin from 8.35.1 to 8.36.0 ([6597d61](https://github.com/deploystackio/deploystack/commit/6597d61628e942e8fc462f2c56b4f35fb59600fc))* bump @vue/eslint-config-typescript from 14.5.1 to 14.6.0 ([20af682](https://github.com/deploystackio/deploystack/commit/20af6823e790d8797fb5a67f9fba51a3913cf78b))* bump eslint-plugin-vue from 10.2.0 to 10.3.0 ([12aa557](https://github.com/deploystackio/deploystack/commit/12aa5575b631fcb844dab84e3d9179b0ad364107))* bump jest from 30.0.3 to 30.0.4 ([90f7cf1](https://github.com/deploystackio/deploystack/commit/90f7cf184e25850094ee38d09c66ece680bacda5))* bump nodemailer from 7.0.4 to 7.0.5 ([165406d](https://github.com/deploystackio/deploystack/commit/165406d97628561fb5a5435968e7c0f66f84756b))* bump supertest from 7.1.1 to 7.1.2 ([3043ed8](https://github.com/deploystackio/deploystack/commit/3043ed83ec2f5067c46cc2b321d0ca8db397f984))* bump typescript-eslint from 8.35.1 to 8.36.0 ([45d8ecd](https://github.com/deploystackio/deploystack/commit/45d8ecdd1265ca16037da38862d785d1e232accf))* bump vue-i18n from 11.1.7 to 11.1.9 ([6f80630](https://github.com/deploystackio/deploystack/commit/6f80630f392adde2de390c2e0d835f8c0aac8b54))* bump vue-tsc from 2.2.10 to 3.0.1 ([6eb773e](https://github.com/deploystackio/deploystack/commit/6eb773eedef989554108600e3c225d04e858ada3))* bump zod from 3.25.67 to 3.25.75 ([f69125a](https://github.com/deploystackio/deploystack/commit/f69125a11013c55b78e403e38dcad816eb82b5aa))* bump @libsql/client in /services/backend ([f92bbd9](https://github.com/deploystackio/deploystack/commit/f92bbd95770f1ba8d5c41bc9142e56eac302ac12))* release v0.23.0 ([c68890a](https://github.com/deploystackio/deploystack/commit/c68890abaf16cb6537d88851f177c6e6f44bc7a0))* Enhance MCP Server Catalog with GitHub integration and pagination ([49ac701](https://github.com/deploystackio/deploystack/commit/49ac7016581efe5e0ddcc6b7d58b8555302e59de))* Implement MCP Server Catalog Management UI ([9197fb6](https://github.com/deploystackio/deploystack/commit/9197fb64e02da7d22298c0ffac595d11e4301c6f))* Update API routes to use preValidation instead of preHandler for global admin checks ([2ad5139](https://github.com/deploystackio/deploystack/commit/2ad5139150af0188fdbd75df4d9b976ad874b63a))*  ([06b1224](https://github.com/deploystackio/deploystack/commit/06b12245cccbc2c0eb0f6c367509fd507ef6e4ae))

## 0.23.0 (2025-07-09)

* Enhance MCP Server Catalog with GitHub integration and pagination ([49ac701](https://github.com/deploystackio/deploystack/commit/49ac7016581efe5e0ddcc6b7d58b8555302e59de))* Implement MCP Server Catalog Management UI ([9197fb6](https://github.com/deploystackio/deploystack/commit/9197fb64e02da7d22298c0ffac595d11e4301c6f))* Update API routes to use preValidation instead of preHandler for global admin checks ([2ad5139](https://github.com/deploystackio/deploystack/commit/2ad5139150af0188fdbd75df4d9b976ad874b63a))* bump @libsql/client from 0.14.0 to 0.15.9 ([d6b7275](https://github.com/deploystackio/deploystack/commit/d6b72759c48ae8fdda29f7e534599155db1e8321))* bump @typescript-eslint/eslint-plugin from 8.35.1 to 8.36.0 ([6597d61](https://github.com/deploystackio/deploystack/commit/6597d61628e942e8fc462f2c56b4f35fb59600fc))* bump @vue/eslint-config-typescript from 14.5.1 to 14.6.0 ([20af682](https://github.com/deploystackio/deploystack/commit/20af6823e790d8797fb5a67f9fba51a3913cf78b))* bump eslint-plugin-vue from 10.2.0 to 10.3.0 ([12aa557](https://github.com/deploystackio/deploystack/commit/12aa5575b631fcb844dab84e3d9179b0ad364107))* bump jest from 30.0.3 to 30.0.4 ([90f7cf1](https://github.com/deploystackio/deploystack/commit/90f7cf184e25850094ee38d09c66ece680bacda5))* bump nodemailer from 7.0.4 to 7.0.5 ([165406d](https://github.com/deploystackio/deploystack/commit/165406d97628561fb5a5435968e7c0f66f84756b))* bump supertest from 7.1.1 to 7.1.2 ([3043ed8](https://github.com/deploystackio/deploystack/commit/3043ed83ec2f5067c46cc2b321d0ca8db397f984))* bump typescript-eslint from 8.35.1 to 8.36.0 ([45d8ecd](https://github.com/deploystackio/deploystack/commit/45d8ecdd1265ca16037da38862d785d1e232accf))* bump vue-i18n from 11.1.7 to 11.1.9 ([6f80630](https://github.com/deploystackio/deploystack/commit/6f80630f392adde2de390c2e0d835f8c0aac8b54))* bump vue-tsc from 2.2.10 to 3.0.1 ([6eb773e](https://github.com/deploystackio/deploystack/commit/6eb773eedef989554108600e3c225d04e858ada3))* bump zod from 3.25.67 to 3.25.75 ([f69125a](https://github.com/deploystackio/deploystack/commit/f69125a11013c55b78e403e38dcad816eb82b5aa))* bump @libsql/client in /services/backend ([f92bbd9](https://github.com/deploystackio/deploystack/commit/f92bbd95770f1ba8d5c41bc9142e56eac302ac12))*  ([06b1224](https://github.com/deploystackio/deploystack/commit/06b12245cccbc2c0eb0f6c367509fd507ef6e4ae))

## <small>0.22.1 (2025-07-07)</small>

* release v0.22.0 ([021a1e8](https://github.com/deploystackio/deploystack/commit/021a1e888dd2fe8cb7a85edb6518c478979a28cd))*  ([7b3b275](https://github.com/deploystackio/deploystack/commit/7b3b275347df10b3f30b0e21dd2457e7c63a6d6a))

## 0.22.0 (2025-07-07)

*  ([7b3b275](https://github.com/deploystackio/deploystack/commit/7b3b275347df10b3f30b0e21dd2457e7c63a6d6a))

## <small>0.21.1 (2025-07-06)</small>

* release v0.21.0 ([b5fba29](https://github.com/deploystackio/deploystack/commit/b5fba29faa63cf956661a85be3f50c88409853a3))* remove action button from empty credentials state and clean up related text ([d83eb9c](https://github.com/deploystackio/deploystack/commit/d83eb9ca009a47906dcdbd11f3b600b386035281))* remove unused components and consolidate credential table logic ([780df9f](https://github.com/deploystackio/deploystack/commit/780df9f2ffbb9169024dcf520d9dfbb5d5a38469))* Remove unused imports from CredentialDetail and TeamTableColumns components ([0b0208e](https://github.com/deploystackio/deploystack/commit/0b0208eced1c8d3f077468a3b49046aec510a921))* Simplify error handling in version retrieval and clean up team member addition logic ([72c8fe4](https://github.com/deploystackio/deploystack/commit/72c8fe42e67dd6a713caf994464d1d5de20f64fd))* Add configurable version display in root API response based on global setting ([0aa6a93](https://github.com/deploystackio/deploystack/commit/0aa6a93311a5d975c9a4b344c53c706e55630d18))* Add health check endpoint for API status monitoring ([e774a38](https://github.com/deploystackio/deploystack/commit/e774a38410d4056ed31868ba85b58ae5977725de))* Enhance credential management by implementing team-based credential retrieval and success message handling ([6742249](https://github.com/deploystackio/deploystack/commit/6742249c8c979f9b570bfa918e456ba8d3418482))* Enhance credentials search functionality with manual search button ([1d58ee4](https://github.com/deploystackio/deploystack/commit/1d58ee4d227acdfbbfcf5c1cc9ba7174ad605f23))* Enhance user teams retrieval by including roles and membership details ([748cd1c](https://github.com/deploystackio/deploystack/commit/748cd1c9e2abc8c9af5fcd8f39f8c8c27787d50e))* Implement cloud credentials management UI and service integration ([bef036b](https://github.com/deploystackio/deploystack/commit/bef036bd464a977ab04681f35d2c71166d96f900))* Implement team member management endpoints and schemas ([bf9ecf8](https://github.com/deploystackio/deploystack/commit/bf9ecf880fa1a1c20b40dea37c616511ca044922))* Implement version management by creating version.ts and updating Dockerfile, workflows, and banner to use dynamic versioning ([29b57c3](https://github.com/deploystackio/deploystack/commit/29b57c32a9f95b5608347f07d79abb4a1627beab))* Refactor team management table by creating a dedicated component and enhancing search functionality ([655660d](https://github.com/deploystackio/deploystack/commit/655660d19ee179c469ccbb9cf7f0ad233723d869))* Update API endpoints in user and cloud credentials tests to include '/api' prefix for consistency ([b228f44](https://github.com/deploystackio/deploystack/commit/b228f447b1d009761f3e9b4c63dd2f8854e5f4eb))* Update table headers to improve styling and consistency across components ([151accb](https://github.com/deploystackio/deploystack/commit/151accb66fbbee75fed92eb71ddaafd6300ec183))* Add comprehensive tests for health route including registration, response validation, and error handling ([80fdfdc](https://github.com/deploystackio/deploystack/commit/80fdfdcf111d7b9cfc7401eefacb85436a92d61e))*  ([e0459d6](https://github.com/deploystackio/deploystack/commit/e0459d69c59543ee5584fe93fc45c99787b9c145))*  ([34458f2](https://github.com/deploystackio/deploystack/commit/34458f296a8e689874a0f212822be8be71fdcb09))

## 0.21.0 (2025-07-06)

* remove action button from empty credentials state and clean up related text ([d83eb9c](https://github.com/deploystackio/deploystack/commit/d83eb9ca009a47906dcdbd11f3b600b386035281))* remove unused components and consolidate credential table logic ([780df9f](https://github.com/deploystackio/deploystack/commit/780df9f2ffbb9169024dcf520d9dfbb5d5a38469))* Remove unused imports from CredentialDetail and TeamTableColumns components ([0b0208e](https://github.com/deploystackio/deploystack/commit/0b0208eced1c8d3f077468a3b49046aec510a921))* Simplify error handling in version retrieval and clean up team member addition logic ([72c8fe4](https://github.com/deploystackio/deploystack/commit/72c8fe42e67dd6a713caf994464d1d5de20f64fd))* Add configurable version display in root API response based on global setting ([0aa6a93](https://github.com/deploystackio/deploystack/commit/0aa6a93311a5d975c9a4b344c53c706e55630d18))* Add health check endpoint for API status monitoring ([e774a38](https://github.com/deploystackio/deploystack/commit/e774a38410d4056ed31868ba85b58ae5977725de))* Enhance credential management by implementing team-based credential retrieval and success message handling ([6742249](https://github.com/deploystackio/deploystack/commit/6742249c8c979f9b570bfa918e456ba8d3418482))* Enhance credentials search functionality with manual search button ([1d58ee4](https://github.com/deploystackio/deploystack/commit/1d58ee4d227acdfbbfcf5c1cc9ba7174ad605f23))* Enhance user teams retrieval by including roles and membership details ([748cd1c](https://github.com/deploystackio/deploystack/commit/748cd1c9e2abc8c9af5fcd8f39f8c8c27787d50e))* Implement cloud credentials management UI and service integration ([bef036b](https://github.com/deploystackio/deploystack/commit/bef036bd464a977ab04681f35d2c71166d96f900))* Implement team member management endpoints and schemas ([bf9ecf8](https://github.com/deploystackio/deploystack/commit/bf9ecf880fa1a1c20b40dea37c616511ca044922))* Implement version management by creating version.ts and updating Dockerfile, workflows, and banner to use dynamic versioning ([29b57c3](https://github.com/deploystackio/deploystack/commit/29b57c32a9f95b5608347f07d79abb4a1627beab))* Refactor team management table by creating a dedicated component and enhancing search functionality ([655660d](https://github.com/deploystackio/deploystack/commit/655660d19ee179c469ccbb9cf7f0ad233723d869))* Update API endpoints in user and cloud credentials tests to include '/api' prefix for consistency ([b228f44](https://github.com/deploystackio/deploystack/commit/b228f447b1d009761f3e9b4c63dd2f8854e5f4eb))* Update table headers to improve styling and consistency across components ([151accb](https://github.com/deploystackio/deploystack/commit/151accb66fbbee75fed92eb71ddaafd6300ec183))* Add comprehensive tests for health route including registration, response validation, and error handling ([80fdfdc](https://github.com/deploystackio/deploystack/commit/80fdfdcf111d7b9cfc7401eefacb85436a92d61e))*  ([e0459d6](https://github.com/deploystackio/deploystack/commit/e0459d69c59543ee5584fe93fc45c99787b9c145))*  ([34458f2](https://github.com/deploystackio/deploystack/commit/34458f296a8e689874a0f212822be8be71fdcb09))

## <small>0.20.9 (2025-07-05)</small>

* remove unused i18n import from Setup.vue ([4f9e315](https://github.com/deploystackio/deploystack/commit/4f9e315ba8ebb9994e2b9fe4db7b18eb3dea497b))* update logging section in README with additional details and examples ([2c975fc](https://github.com/deploystackio/deploystack/commit/2c975fcdfd00df81fc0cd507817e587e5acf565f))* update @typescript-eslint/parser to version 8.35.1 and add license information ([6c0c303](https://github.com/deploystackio/deploystack/commit/6c0c303bd2a950749d9da62f48e9fc3c6b54fbad))* bump @tailwindcss/postcss from 4.1.10 to 4.1.11 ([b0a0537](https://github.com/deploystackio/deploystack/commit/b0a0537701c3aa4f21711e519a9b9a2ddecc646d))* bump @tailwindcss/vite from 4.1.10 to 4.1.11 ([3f9af39](https://github.com/deploystackio/deploystack/commit/3f9af3916c2f25881ea3fb8fb0eb8444289413e4))* bump @types/node from 24.0.3 to 24.0.7 ([ca8fff3](https://github.com/deploystackio/deploystack/commit/ca8fff343f2e3cdb23d5eeb4e9cb95ac518cfe72))* bump @typescript-eslint/eslint-plugin from 8.35.0 to 8.35.1 ([1acf799](https://github.com/deploystackio/deploystack/commit/1acf79919652091bb33e9b2ad574e98e4006d298))* bump @vitejs/plugin-vue from 5.2.4 to 6.0.0 ([778701c](https://github.com/deploystackio/deploystack/commit/778701c4f8dde5c63d3afe1ea9ac7570fa4b7ed0))* bump better-sqlite3 from 12.1.1 to 12.2.0 ([db8f8ec](https://github.com/deploystackio/deploystack/commit/db8f8eca3f82edaebb8aa7bfae6a34c0f4815562))* bump eslint from 9.29.0 to 9.30.0 ([614aefc](https://github.com/deploystackio/deploystack/commit/614aefc76e4d5f1d780fcecfdec4e96418d10213))* bump nodemailer from 7.0.3 to 7.0.4 ([36e3b44](https://github.com/deploystackio/deploystack/commit/36e3b44992efe5bef7460a24bb7e93e688131e9a))* bump tailwindcss from 4.1.10 to 4.1.11 ([e60d1c4](https://github.com/deploystackio/deploystack/commit/e60d1c47ba26135c0719dc2ef3dc42e6b9fe12eb))* bump typescript-eslint from 8.35.0 to 8.35.1 ([be3bb86](https://github.com/deploystackio/deploystack/commit/be3bb86746f9074689e32c8664ed68f4148c262b))* bump vite from 6.3.5 to 7.0.0 ([19794e4](https://github.com/deploystackio/deploystack/commit/19794e48d3f6ec88b01397c49e24517a48f5bc4e))* bump zod-to-json-schema from 3.24.5 to 3.24.6 ([53f59c1](https://github.com/deploystackio/deploystack/commit/53f59c19b37bad9912b9b528af0896d565343946))* release v0.20.8 ([62576b0](https://github.com/deploystackio/deploystack/commit/62576b00bb63b9682e0b618de927c676f60ae768))* update rootDir in tsconfig.json to 'src' ([7c1be68](https://github.com/deploystackio/deploystack/commit/7c1be68adf798675fd6c4cebd66cb8eb934c75f3))* add cross-user permissions tests and update test context structure ([6ab293c](https://github.com/deploystackio/deploystack/commit/6ab293c21cec4af2840c59a4ed5cebb106655f6e))* disable eslint rule for explicit any in cloud providers and cloud credentials routes ([5cfeaa7](https://github.com/deploystackio/deploystack/commit/5cfeaa76022ad34dec73a3787c6725d99dc05b26))*  ([8d47c2b](https://github.com/deploystackio/deploystack/commit/8d47c2bc8336d829e146592099fed1996d7bfc37))

## <small>0.20.8 (2025-07-05)</small>

* add cross-user permissions tests and update test context structure ([6ab293c](https://github.com/deploystackio/deploystack/commit/6ab293c21cec4af2840c59a4ed5cebb106655f6e))* update @typescript-eslint/parser to version 8.35.1 and add license information ([6c0c303](https://github.com/deploystackio/deploystack/commit/6c0c303bd2a950749d9da62f48e9fc3c6b54fbad))* bump @tailwindcss/postcss from 4.1.10 to 4.1.11 ([b0a0537](https://github.com/deploystackio/deploystack/commit/b0a0537701c3aa4f21711e519a9b9a2ddecc646d))* bump @tailwindcss/vite from 4.1.10 to 4.1.11 ([3f9af39](https://github.com/deploystackio/deploystack/commit/3f9af3916c2f25881ea3fb8fb0eb8444289413e4))* bump @types/node from 24.0.3 to 24.0.7 ([ca8fff3](https://github.com/deploystackio/deploystack/commit/ca8fff343f2e3cdb23d5eeb4e9cb95ac518cfe72))* bump @typescript-eslint/eslint-plugin from 8.35.0 to 8.35.1 ([1acf799](https://github.com/deploystackio/deploystack/commit/1acf79919652091bb33e9b2ad574e98e4006d298))* bump @vitejs/plugin-vue from 5.2.4 to 6.0.0 ([778701c](https://github.com/deploystackio/deploystack/commit/778701c4f8dde5c63d3afe1ea9ac7570fa4b7ed0))* bump better-sqlite3 from 12.1.1 to 12.2.0 ([db8f8ec](https://github.com/deploystackio/deploystack/commit/db8f8eca3f82edaebb8aa7bfae6a34c0f4815562))* bump eslint from 9.29.0 to 9.30.0 ([614aefc](https://github.com/deploystackio/deploystack/commit/614aefc76e4d5f1d780fcecfdec4e96418d10213))* bump nodemailer from 7.0.3 to 7.0.4 ([36e3b44](https://github.com/deploystackio/deploystack/commit/36e3b44992efe5bef7460a24bb7e93e688131e9a))* bump tailwindcss from 4.1.10 to 4.1.11 ([e60d1c4](https://github.com/deploystackio/deploystack/commit/e60d1c47ba26135c0719dc2ef3dc42e6b9fe12eb))* bump typescript-eslint from 8.35.0 to 8.35.1 ([be3bb86](https://github.com/deploystackio/deploystack/commit/be3bb86746f9074689e32c8664ed68f4148c262b))* bump vite from 6.3.5 to 7.0.0 ([19794e4](https://github.com/deploystackio/deploystack/commit/19794e48d3f6ec88b01397c49e24517a48f5bc4e))* bump zod-to-json-schema from 3.24.5 to 3.24.6 ([53f59c1](https://github.com/deploystackio/deploystack/commit/53f59c19b37bad9912b9b528af0896d565343946))* update rootDir in tsconfig.json to 'src' ([7c1be68](https://github.com/deploystackio/deploystack/commit/7c1be68adf798675fd6c4cebd66cb8eb934c75f3))* disable eslint rule for explicit any in cloud providers and cloud credentials routes ([5cfeaa7](https://github.com/deploystackio/deploystack/commit/5cfeaa76022ad34dec73a3787c6725d99dc05b26))*  ([8d47c2b](https://github.com/deploystackio/deploystack/commit/8d47c2bc8336d829e146592099fed1996d7bfc37))

## <small>0.20.7 (2025-06-29)</small>

* update @vitest/coverage-v8 dependency to version 3.2.3 ([f11484f](https://github.com/deploystackio/deploystack/commit/f11484ff6352955f63e26d64a42ad4a1f0f49738))* bump @tailwindcss/postcss from 4.1.8 to 4.1.10 ([9c89ea0](https://github.com/deploystackio/deploystack/commit/9c89ea0bb9ad408ac5ae0cb8f23379ece7224a9a))* bump @tailwindcss/vite from 4.1.8 to 4.1.10 ([da500bf](https://github.com/deploystackio/deploystack/commit/da500bfb5aa764c993b1b29a6dae1ac1a63778e3))* bump @types/node from 22.15.29 to 24.0.3 ([218daf4](https://github.com/deploystackio/deploystack/commit/218daf4951ef4fe4d17bcc21762ad81914530fa2))* bump @typescript-eslint/parser from 8.34.1 to 8.35.0 ([b38e9f0](https://github.com/deploystackio/deploystack/commit/b38e9f048cea8783fd2c7774d51220b2adad0688))* bump @vee-validate/zod from 4.15.0 to 4.15.1 ([71f2eda](https://github.com/deploystackio/deploystack/commit/71f2eda8310568adce02c7029f2aae1cb7528ebc))* bump @vue/eslint-config-typescript from 14.5.0 to 14.5.1 ([be9c979](https://github.com/deploystackio/deploystack/commit/be9c979d432338b9ea64e4d2d7e121f9dcaab341))* bump drizzle-kit from 0.31.1 to 0.31.2 ([49cd806](https://github.com/deploystackio/deploystack/commit/49cd806214c52620c60e9ed4a7d07071a85599b7))* bump drizzle-orm from 0.44.1 to 0.44.2 ([d0918ac](https://github.com/deploystackio/deploystack/commit/d0918ac16a512620adcf136eb0d6c7269563c079))* bump eslint from 9.28.0 to 9.29.0 ([05f1132](https://github.com/deploystackio/deploystack/commit/05f11328349d770d8724003cf54539f3e648da1c))* bump eslint-plugin-vue from 10.1.0 to 10.2.0 ([2888680](https://github.com/deploystackio/deploystack/commit/288868050d91b60bfe3b264853dbc2208d35ec60))* bump fastify from 5.3.3 to 5.4.0 ([596e7a9](https://github.com/deploystackio/deploystack/commit/596e7a900502df8a5e1670b6108fb9c4efd68b4e))* bump lucide-vue-next from 0.511.0 to 0.522.0 ([aa9f2b2](https://github.com/deploystackio/deploystack/commit/aa9f2b23bc47cf26a9dc670098c362b46aa1ff74))* bump nodemailer from 6.10.1 to 7.0.3 ([66cc7b0](https://github.com/deploystackio/deploystack/commit/66cc7b0b834136e863ea7c1c72c6aa20dd3cf482))* bump pinia from 3.0.2 to 3.0.3 ([95fa45d](https://github.com/deploystackio/deploystack/commit/95fa45db712663ce1a9e6be48320480de51ae2f5))* bump prettier from 3.5.3 to 3.6.0 ([b49f98d](https://github.com/deploystackio/deploystack/commit/b49f98d44a0fd088e2251c7a20878aeb6582da74))* bump tailwind-merge from 3.3.0 to 3.3.1 ([055e26c](https://github.com/deploystackio/deploystack/commit/055e26c7d077d3c0b8af83a4c9e0c986a99b09c5))* bump ts-jest from 29.3.4 to 29.4.0 ([574f595](https://github.com/deploystackio/deploystack/commit/574f595fa62aafb0d0cf6e81ce80e2132f39493a))* bump typescript-eslint from 8.33.0 to 8.34.1 ([ca1c730](https://github.com/deploystackio/deploystack/commit/ca1c7307c4a572095357888f15b55e076559edef))* bump typescript-eslint from 8.34.1 to 8.35.0 ([a40c66e](https://github.com/deploystackio/deploystack/commit/a40c66ead2d0dc9a5aef2560a395e69e9d7fa2a1))* bump vee-validate from 4.15.0 to 4.15.1 ([bb4ae92](https://github.com/deploystackio/deploystack/commit/bb4ae921131dc54257d9b6b7a835674f004cf69b))* bump vite-plugin-vue-devtools from 7.7.6 to 7.7.7 ([56b7aea](https://github.com/deploystackio/deploystack/commit/56b7aeaad311bfe5d9ff739933ae9ef37ea67aa6))* bump vitest from 2.1.9 to 3.2.3 ([13a744e](https://github.com/deploystackio/deploystack/commit/13a744edf756e44b48c09370a09c463ffcb1635e))* bump vue from 3.5.16 to 3.5.17 ([a099ccb](https://github.com/deploystackio/deploystack/commit/a099ccba8b1ffb66b3efca12a12485492a6ae4dc))* bump vue-i18n from 11.1.5 to 11.1.7 ([617761b](https://github.com/deploystackio/deploystack/commit/617761b40d4274d1c90874fa19f0fba742d80599))* bump zod from 3.25.49 to 3.25.65 ([5fd7dd6](https://github.com/deploystackio/deploystack/commit/5fd7dd6279f5b2dfb19c19fc8d0564e819a65655))* bump @types/jest in /services/backend ([9ec4510](https://github.com/deploystackio/deploystack/commit/9ec451030a13020a4c4eff83e1786e01dd222976))* bump better-sqlite3 in /services/backend ([c995299](https://github.com/deploystackio/deploystack/commit/c9952994def13b8abe715d20be668423a4a0fcda))* bump jest from 29.7.0 to 30.0.0 in /services/backend ([d961505](https://github.com/deploystackio/deploystack/commit/d961505df111257c15bf098bdcdb0a095fb53f60))* release v0.20.5 ([284dcbc](https://github.com/deploystackio/deploystack/commit/284dcbccd20ea64e85411f45941ce287d12bfcc2))* release v0.20.6 ([6c4e16f](https://github.com/deploystackio/deploystack/commit/6c4e16f788cc655ff64f765a59a6001825d898b8))* clean up comments in AppSidebar and DashboardLayout components for clarity ([7e798dd](https://github.com/deploystackio/deploystack/commit/7e798dd32f4cec3f90482382d26c4ba5d8abdb21))* enhance sidebar spacer behavior for expanded and collapsed states in DashboardLayout component ([1bc4a83](https://github.com/deploystackio/deploystack/commit/1bc4a83abf64ed5e2b1f7dae625dd60946dd89a3))* improve sidebar layout and CSS variable handling in DashboardLayout component ([9d0986a](https://github.com/deploystackio/deploystack/commit/9d0986a0f47a6cce7ed715fae5b8fb32ff10ef4f))* remove console logs and unused form validation logic in GlobalSettings component ([23b6d7f](https://github.com/deploystackio/deploystack/commit/23b6d7fac649e6bee94dc64818ba79a0a0e887b7))* remove console logs for cleaner code in GlobalSettings component ([a23a4bb](https://github.com/deploystackio/deploystack/commit/a23a4bb8a3a92f950b9b18b1dacc7a8669c24de6))* remove deprecated users table columns and clean up schema definitions ([5169330](https://github.com/deploystackio/deploystack/commit/51693307f4dc54f7b7331b649cb4d56de4a8154a))* remove old team management views and implement new team management structure ([45561f0](https://github.com/deploystackio/deploystack/commit/45561f05748dc9eafd6a92829f6acbff89230cda))* remove unnecessary margin from sidebar in GlobalSettings component ([df8bba8](https://github.com/deploystackio/deploystack/commit/df8bba8b8f48f1c90c5701f225ff3a4fb82650bd))* remove unused Button import from AppSidebar component ([a19ce4a](https://github.com/deploystackio/deploystack/commit/a19ce4a5afaccb1e75820da828ae3bfefaec2659))* remove unused favicon import and update request handlers to use underscore for unused parameters ([9ee78fd](https://github.com/deploystackio/deploystack/commit/9ee78fddd2c8384045bd32a4f5d48a837891e202))* remove unused generateId import from globalSettingsService ([59e2c60](https://github.com/deploystackio/deploystack/commit/59e2c600d9a010a0bead022fbc4683dbc3d02a6f))* remove unused user registration route and example user fetching route from API ([e82e85d](https://github.com/deploystackio/deploystack/commit/e82e85dfdf632cf9a6550aa0095cea5d57a06d06))* remove users table and update database setup for persistence ([1eb9e4a](https://github.com/deploystackio/deploystack/commit/1eb9e4af13c2f686b16601fdb2b3326e35a65dc2))* rename 'email' to 'login' in authentication tests and login form for consistency ([161b0bf](https://github.com/deploystackio/deploystack/commit/161b0bfa5b0e53d794e60700422c926271c41b68))* replace Button with SidebarMenuButton in AppSidebar and update sidebar width variables in DashboardLayout ([031e128](https://github.com/deploystackio/deploystack/commit/031e128d407e11aa802103cd2dff1d0ebbd9f726))* replace forgot password button with router link for navigation ([269fa69](https://github.com/deploystackio/deploystack/commit/269fa6954d7b82718b2e607f25380bc5ed0588db))* Replace permission checks with global admin requirement in global settings route ([a2c36b0](https://github.com/deploystackio/deploystack/commit/a2c36b0cf2babed8ee8aec70596ad6e9ae1f8f48))* simplify defaultOpen handling and enhance sidebar accessibility with titles and descriptions ([63c2184](https://github.com/deploystackio/deploystack/commit/63c218462d48005c0b9f64345f7d04aaa146523d))* update formValues type to improve type safety and consistency in GlobalSettings component ([f46ff4e](https://github.com/deploystackio/deploystack/commit/f46ff4e5b348b7d020173f9d32e1e311caaf4e6e))* add @types/better-sqlite3 for improved TypeScript support and refactor database functions for clarity ([0dddbd0](https://github.com/deploystackio/deploystack/commit/0dddbd025a7332dd876ff0544a6608fc270b4561))* add change password endpoint for authenticated users ([c9a229b](https://github.com/deploystackio/deploystack/commit/c9a229b9163d720afcaa8af1bcf704eb4f247fb5))* add dashboard view with user data fetching and error handling ([d9fe33e](https://github.com/deploystackio/deploystack/commit/d9fe33e20cd302eb3f650ee76928928c8eaf074c))* add end-to-end tests for global settings access control and update test sequencer order ([64558e1](https://github.com/deploystackio/deploystack/commit/64558e1fd2b3c2b1e9b8026bb2bb89a18ce01e69))* add end-to-end tests for global settings initialization and access control ([a78bee5](https://github.com/deploystackio/deploystack/commit/a78bee5e6cc3eacb49ec7af00da6e17c4002edc3))* add endpoint to retrieve current user's default team ([3e42403](https://github.com/deploystackio/deploystack/commit/3e424032c915dbef1531e4abff4604d299c292ea))* add forgot password and reset password functionality with corresponding routes and localization ([60fa4f2](https://github.com/deploystackio/deploystack/commit/60fa4f2bc3438cf10c671cbfa33a86a91efc4b64))* add global settings check test to custom test sequencer order ([587a32a](https://github.com/deploystackio/deploystack/commit/587a32a5d1c99213624aa3f4f0d61c8d29a99198))* add global settings for application configuration and enable Swagger documentation control ([48e2a51](https://github.com/deploystackio/deploystack/commit/48e2a51f7c3940229d02181fb263ba986c5e5d36))* add global settings table and related permissions, update README and SECURITY documentation ([59ebf4f](https://github.com/deploystackio/deploystack/commit/59ebf4f5f994eb38e40c65daa58cf67d44209a9c))* add initial docker-compose configuration for backend and frontend services ([e0e3fd0](https://github.com/deploystackio/deploystack/commit/e0e3fd0fcbe140e4e4d96593d8f72c55ddfd49b4))* add setup success message to Setup view and update translations, remove unused imports in Users view ([c51425b](https://github.com/deploystackio/deploystack/commit/c51425b4dc6a41aaba25f59f60f664d6b6c8bec4))* Add Swagger documentation and API specification generation ([8753a48](https://github.com/deploystackio/deploystack/commit/8753a489947643fed799184b72f047bd22cf8aa2))* add table component suite with header, body, footer, and cell support ([e5c3671](https://github.com/deploystackio/deploystack/commit/e5c367133119f9834eb336b51254d490f9153c90))* add team and team membership functionality ([b0f485a](https://github.com/deploystackio/deploystack/commit/b0f485ad2ccc89d4fe51e7d3e3d20bb280863a5f))* add title for navigation in dashboard localization ([33d6e28](https://github.com/deploystackio/deploystack/commit/33d6e28b8422efec342cb8337f1e5c01200fc24c))* add type annotations and improve type safety in various components and services ([5314ea5](https://github.com/deploystackio/deploystack/commit/5314ea58ea356cea57d904e23250023ef9b42207))* add type support to settings and implement dynamic form handling for global settings ([9ef739e](https://github.com/deploystackio/deploystack/commit/9ef739e1c38d4f9fdd916178161a3d00ddb1bce4))* add user detail view and navigation from users list ([7449649](https://github.com/deploystackio/deploystack/commit/7449649a3f7953422d2f4a8384eae2cef401cf38))* add user management page and sidebar navigation, include internationalization support for admin users ([6f3789b](https://github.com/deploystackio/deploystack/commit/6f3789bc12c2ca1312316c11f3f112b9ac51e357))* add user teams management in UserDetail.vue and implement related API tests ([2e7efca](https://github.com/deploystackio/deploystack/commit/2e7efca5bda6e65fbff42cacc449586f7bcb2b7b))* add watcher to reset success alert on route changes in GlobalSettings component ([0a807f2](https://github.com/deploystackio/deploystack/commit/0a807f297be846ff210bb14371b468d66c9268c6))* Enhance API documentation and response schemas for GitHub auth, global settings, and roles ([da94544](https://github.com/deploystackio/deploystack/commit/da945448f20129aced095622caff6c70ea3332a1))* enhance DashboardLayout and GlobalSettings components with improved sidebar and layout adjustments ([88b1e49](https://github.com/deploystackio/deploystack/commit/88b1e493ec89a28832cd37b3d653ce351db55d1a))* enhance global settings handling with proper type conversion for boolean and number values ([a3e1ec3](https://github.com/deploystackio/deploystack/commit/a3e1ec3e259707f40ea5a4b92c235716498ce7f4))* Enhance global settings with type support ([db3f61e](https://github.com/deploystackio/deploystack/commit/db3f61e6f983cc305100e132f05a6d1b602989c9))* enhance global setup by cleaning entire persistent_data directory before tests ([cd5177a](https://github.com/deploystackio/deploystack/commit/cd5177ae1bfd25218d98c2a6ea5256ebf9d82512))* enhance sidebar and sheet components with data slots and improved styling ([56ca7fb](https://github.com/deploystackio/deploystack/commit/56ca7fbdb0976857f07f8599707e72514c9e8643))* enhance success alert visibility and layout in GlobalSettings component ([99e8ae8](https://github.com/deploystackio/deploystack/commit/99e8ae8b3798e5859dc5e4c6810438e372adc079))* enhance user detail view with internationalization support and improved layout ([961c25d](https://github.com/deploystackio/deploystack/commit/961c25d6d967812f3a4466404e4fffb695aa9741))* Enhance users API with detailed response schemas and OpenAPI documentation ([a783208](https://github.com/deploystackio/deploystack/commit/a78320811837ab922687b7de8ddc4ba509e4caf5))* implement admin-initiated password reset functionality with email notification ([5c6345b](https://github.com/deploystackio/deploystack/commit/5c6345bdfd1fa2f9a4664cb0a2d808189f3f80c3))* implement alert dialog components and admin password reset functionality ([02325c9](https://github.com/deploystackio/deploystack/commit/02325c90282335e37892d871910faa5f8ea874fd))* implement AppSidebar and DashboardLayout components with user and team management features ([29eb7b7](https://github.com/deploystackio/deploystack/commit/29eb7b71a53257f5c14741fcb4ee71e20868ae93))* implement email verification system ([0b06feb](https://github.com/deploystackio/deploystack/commit/0b06feb92b23343ba9482330d84e1e9d9aef47d3))* implement global settings initialization and define GitHub OAuth and SMTP configuration modules ([5cd79cf](https://github.com/deploystackio/deploystack/commit/5cd79cf3571956846fb443da7e944b4781ed6998))* implement global settings management with group support and enhance UI alerts ([65909a1](https://github.com/deploystackio/deploystack/commit/65909a1ac4af2408a07d8707c1bf8a0679ce6896))* implement global settings page with role-based access, add not found page, and enhance user data fetching ([922994d](https://github.com/deploystackio/deploystack/commit/922994d9512bb86f8ddaa34862d0500844989d14))* implement logout functionality and enhance session management ([8e85ec4](https://github.com/deploystackio/deploystack/commit/8e85ec4354ac9208cf03bdf7777d16d3f2ecc184))* implement password change notification email and update user account routing ([40ab50a](https://github.com/deploystackio/deploystack/commit/40ab50a27e82dec9543a57ed2fdb31972e97cdd5))* implement password reset functionality with token management and email notifications ([4cd1fce](https://github.com/deploystackio/deploystack/commit/4cd1fcef867eadff2e9129aed3b8f0e381d13431))* implement plugin route structure and registration system for enhanced security and isolation ([9ea843e](https://github.com/deploystackio/deploystack/commit/9ea843e38c5043d0360df13def37ea9cca2ebc73))* implement plugin support for global settings, allowing plugins to define and manage their own settings and groups ([a1fbed4](https://github.com/deploystackio/deploystack/commit/a1fbed4f91ae46cb01e0aa0f673c9780a327ee2f))* implement smart caching for user and team services to optimize API calls and improve performance on public routes ([34dc0f0](https://github.com/deploystackio/deploystack/commit/34dc0f02493a1c6b78abe14145e5031c8357b9fa))* implement team management features with API integration ([bc403a3](https://github.com/deploystackio/deploystack/commit/bc403a3b29a8845b2f5d8c6f9a5fd45cb902ce1a))* implement team selection event handling and UI updates in Teams and AppSidebar components ([03f92c9](https://github.com/deploystackio/deploystack/commit/03f92c96ddaf40a8c2c9d0ec81671d1eaf3e94b9))* implement user authentication check in router and create UserService for fetching current user ([e48b5b9](https://github.com/deploystackio/deploystack/commit/e48b5b9170d5ce1e6f4bf69d1577350b3aeffa09))* implement user login via email/password and update API documentation ([86fba41](https://github.com/deploystackio/deploystack/commit/86fba4189c6f8e9163db45f64c16356201a7b342))* integrate zod and zod-to-json-schema for improved request/response validation in authentication routes ([7f96b3b](https://github.com/deploystackio/deploystack/commit/7f96b3bcec5b0135a69982d6caf39c28a33916a3))* refactor database schema management by consolidating schema definitions and removing legacy schema file ([3776fd0](https://github.com/deploystackio/deploystack/commit/3776fd07705f6e7a93b2b204ecb8bdd91c6dc7a3))* refactor global settings structure to use groups instead of categories, update related schemas and routes ([1d4b043](https://github.com/deploystackio/deploystack/commit/1d4b043fd3eb736aab4321c06a7f054a37385ef7))* replace dynamic schema generation with static schema import and enhance session validation logic ([6eaeaa8](https://github.com/deploystackio/deploystack/commit/6eaeaa8c574d32f160a8125538bae41e35330e0b))* restructure global settings route and update sidebar navigation, enhance GlobalSettings view with DashboardLayout ([f18b7ea](https://github.com/deploystackio/deploystack/commit/f18b7eacd48de81380f9d6eb6c5a4fb4cc7fcdd8))* streamline user registration by removing manual session creation and simplifying response handling ([149b356](https://github.com/deploystackio/deploystack/commit/149b3567311603b3e77f3110f251c6424fab42d3))* update admin settings route to include optional groupId parameter ([5bb7691](https://github.com/deploystackio/deploystack/commit/5bb7691fba0e047bd3cd096cdf1de68acc54f1a7))* update database configuration for test environment and refactor encryption key handling ([8f8fd2e](https://github.com/deploystackio/deploystack/commit/8f8fd2eca1e56887f483ce99ab891244dc364a68))* update database schema tests to use static schema module and remove unused imports ([77d01aa](https://github.com/deploystackio/deploystack/commit/77d01aa35a76e2ac5faf4401c3708da3cbc23e74))* update development environment with nodemon configuration and enhance Teams view styling ([9c4bb9c](https://github.com/deploystackio/deploystack/commit/9c4bb9c834667447863aa1b8f4bb2a9fdb71c16f))* update user and team service response handling and cache management ([e14cce4](https://github.com/deploystackio/deploystack/commit/e14cce43672778a9be210115126b4d004fe7c587))*  ([2b876c1](https://github.com/deploystackio/deploystack/commit/2b876c1c7d9b587229a7f6423f4d348eed750439))*  ([f5ccdf4](https://github.com/deploystackio/deploystack/commit/f5ccdf429fc7424159325bddc037678377f3cdcd))*  ([483fe3c](https://github.com/deploystackio/deploystack/commit/483fe3c0a14c274a5f385afb90f05949abc23af3))*  ([3d9d7bd](https://github.com/deploystackio/deploystack/commit/3d9d7bdfcf7425c24a6fc26223eedaddb7f5b951))*  ([40cac89](https://github.com/deploystackio/deploystack/commit/40cac89fada5e19cd68ab295b9cdbc7f7eb207c0))*  ([1417891](https://github.com/deploystackio/deploystack/commit/1417891297d56830fec1444941e5e0fa02369ff8))*  ([2b84cfa](https://github.com/deploystackio/deploystack/commit/2b84cfa97f41f7c00d141bc32375cd485bb34fad))*  ([8335923](https://github.com/deploystackio/deploystack/commit/8335923542ea5f16a57a8ea0c9f7dc34c260ae4c))*  ([51cfe4b](https://github.com/deploystackio/deploystack/commit/51cfe4bb61c0fc55e93513a29c53536aba51bc48))* refactor console logging in deleteDbConfig tests for clarity and consistency ([1b255be](https://github.com/deploystackio/deploystack/commit/1b255be5d6c427b266d4c9bb78b9d3c400fbe596))* update API documentation and plugin security features for clarity and consistency ([c99184e](https://github.com/deploystackio/deploystack/commit/c99184e8c5e15e4d8f9b4f6d11363889ac5cc161))* Update API documentation for clarity and formatting improvements ([83abf19](https://github.com/deploystackio/deploystack/commit/83abf192406b37c112eafd9010af6b91e6aef8fa))* update documentation for global settings and email integration with improved formatting ([7e689d5](https://github.com/deploystackio/deploystack/commit/7e689d56ec8b68ad7f051aac2b582d2ca117f49e))* add missing line breaks in Docker command examples for clarity ([1ef1ca4](https://github.com/deploystackio/deploystack/commit/1ef1ca438e315113d03e56d273fc7adc89b8cf22))* avoid modifying immutable commit object in release-it transform ([08e93f4](https://github.com/deploystackio/deploystack/commit/08e93f4ec6ac056f3db45f9333c72884cb83861d))* correct plugin paths configuration for better clarity and maintainability ([06d5bb8](https://github.com/deploystackio/deploystack/commit/06d5bb8d961ef351908cf18dcbc0c90b9e8bf80a))* enhance error handling for database connection and update error messages ([b255245](https://github.com/deploystackio/deploystack/commit/b25524556ed0aa92b3873f2460d1f9cd622f8e5f))* enhance frontend release workflow with improved dependency installation and build handling ([4eaca2e](https://github.com/deploystackio/deploystack/commit/4eaca2e3658460096e06bc8c16070d664ebb153a))* hardcode GitHub repository URL in commit links for changelog ([199befb](https://github.com/deploystackio/deploystack/commit/199befb4e363e634f4307602284d91d6ea5aab01))* improve frontend release workflow with enhanced dependency installation and release notes extraction ([d50e10a](https://github.com/deploystackio/deploystack/commit/d50e10a846f93380d3f31201bc1557934bbede59))* remove unnecessary dbInstance parameter from createPluginTables call ([eaad7c3](https://github.com/deploystackio/deploystack/commit/eaad7c375dd0a0b912ab260fdcdf28da54f9ba5d))* remove unnecessary empty markdown link cleanup from workflows ([ab446cb](https://github.com/deploystackio/deploystack/commit/ab446cbd30748e4ca068f42f7d1fa3bf434bd815))* update API URL references to use VITE_DEPLOYSTACK_BACKEND_URL in AppSidebar and TeamService components ([82ce3c4](https://github.com/deploystackio/deploystack/commit/82ce3c499049b150cba5608dd9002e3c922f51dd))* update API URL to use VITE_DEPLOYSTACK_BACKEND_URL in Login and Register components ([1b3477a](https://github.com/deploystackio/deploystack/commit/1b3477abd4aedc8bd657c9e552e94cee34e71c01))* update base URL and enhance fetch requests with session management ([d164940](https://github.com/deploystackio/deploystack/commit/d1649403c4d38206ec5d6f1db08d7df974933075))* update conventional changelog plugin configuration for backend and frontend ([bbcfbf4](https://github.com/deploystackio/deploystack/commit/bbcfbf4da3edec1de943605fa1482aa6bab5b9fd))* update Docker run command for frontend environment variables ([348b77a](https://github.com/deploystackio/deploystack/commit/348b77aaf69c170e6e57184406270e9e55c728ac))* update Docker run command to map port 8080 to 80 for frontend ([538d5fc](https://github.com/deploystackio/deploystack/commit/538d5fc28f8e3b74fa6b71cf112e328ec0d97f57))* update environment variable names for frontend and backend URLs in Docker commands and CORS configuration ([07111a4](https://github.com/deploystackio/deploystack/commit/07111a4a75ea1d23ac9e0f3a6a75745e0d87bc7f))* update error handling to include Bad Request status for invalid credentials ([a6f4e00](https://github.com/deploystackio/deploystack/commit/a6f4e00b7c1847c46cc13b3f6367cb255ec47575))* update ESLint configuration to ignore temporary TypeScript files and remove unused type imports in global settings and plugin manager ([1ba2aaa](https://github.com/deploystackio/deploystack/commit/1ba2aaa34213ddada82b7ffaf49b1abb6d191fbc))* update favicon.ico for improved branding ([e5d3ba5](https://github.com/deploystackio/deploystack/commit/e5d3ba5b0744ee05ac7253ca2538bff06a16e6ac))* update release-it configuration to properly format commit links in changelog ([aa00be1](https://github.com/deploystackio/deploystack/commit/aa00be14bec205d77f85cd167c9d05cea6ee2914))* update storage key handling in DatabaseService to use dynamic baseUrl ([9b613f5](https://github.com/deploystackio/deploystack/commit/9b613f5d4633f1b89fcdb08f1274c6dce43ff088))* update timestamp creation to use Date object instead of Date.now() in createGroups method ([4f163de](https://github.com/deploystackio/deploystack/commit/4f163defb4d88e3db1c59f5caed1919c1d239860))* use proper URL template variables for commit links in changelog ([8c6f600](https://github.com/deploystackio/deploystack/commit/8c6f6003c70e2076def308f1fa4bba6565912920))* wrap boolean switch in a div for consistent layout in settings form ([f29abcf](https://github.com/deploystackio/deploystack/commit/f29abcf70e37527f290a53d89e31f1a81fd3d4d2))* enhance button cursor styles and remove test environment display from login component ([02c26fd](https://github.com/deploystackio/deploystack/commit/02c26fd1c81d863bc91ab9d45ed4a968e8475971))* update environment variable references to use VITE_DEPLOYSTACK_APP_URL ([d7361d5](https://github.com/deploystackio/deploystack/commit/d7361d562a0a22569cc910fd422bdb91318b6595))

## <small>0.20.6 (2025-06-29)</small>

* update @vitest/coverage-v8 dependency to version 3.2.3 ([f11484f](https://github.com/deploystackio/deploystack/commit/f11484ff6352955f63e26d64a42ad4a1f0f49738))* bump @tailwindcss/postcss from 4.1.8 to 4.1.10 ([9c89ea0](https://github.com/deploystackio/deploystack/commit/9c89ea0bb9ad408ac5ae0cb8f23379ece7224a9a))* bump @tailwindcss/vite from 4.1.8 to 4.1.10 ([da500bf](https://github.com/deploystackio/deploystack/commit/da500bfb5aa764c993b1b29a6dae1ac1a63778e3))* bump @types/node from 22.15.29 to 24.0.3 ([218daf4](https://github.com/deploystackio/deploystack/commit/218daf4951ef4fe4d17bcc21762ad81914530fa2))* bump @typescript-eslint/parser from 8.34.1 to 8.35.0 ([b38e9f0](https://github.com/deploystackio/deploystack/commit/b38e9f048cea8783fd2c7774d51220b2adad0688))* bump @vee-validate/zod from 4.15.0 to 4.15.1 ([71f2eda](https://github.com/deploystackio/deploystack/commit/71f2eda8310568adce02c7029f2aae1cb7528ebc))* bump @vue/eslint-config-typescript from 14.5.0 to 14.5.1 ([be9c979](https://github.com/deploystackio/deploystack/commit/be9c979d432338b9ea64e4d2d7e121f9dcaab341))* bump drizzle-kit from 0.31.1 to 0.31.2 ([49cd806](https://github.com/deploystackio/deploystack/commit/49cd806214c52620c60e9ed4a7d07071a85599b7))* bump drizzle-orm from 0.44.1 to 0.44.2 ([d0918ac](https://github.com/deploystackio/deploystack/commit/d0918ac16a512620adcf136eb0d6c7269563c079))* bump eslint from 9.28.0 to 9.29.0 ([05f1132](https://github.com/deploystackio/deploystack/commit/05f11328349d770d8724003cf54539f3e648da1c))* bump eslint-plugin-vue from 10.1.0 to 10.2.0 ([2888680](https://github.com/deploystackio/deploystack/commit/288868050d91b60bfe3b264853dbc2208d35ec60))* bump fastify from 5.3.3 to 5.4.0 ([596e7a9](https://github.com/deploystackio/deploystack/commit/596e7a900502df8a5e1670b6108fb9c4efd68b4e))* bump lucide-vue-next from 0.511.0 to 0.522.0 ([aa9f2b2](https://github.com/deploystackio/deploystack/commit/aa9f2b23bc47cf26a9dc670098c362b46aa1ff74))* bump nodemailer from 6.10.1 to 7.0.3 ([66cc7b0](https://github.com/deploystackio/deploystack/commit/66cc7b0b834136e863ea7c1c72c6aa20dd3cf482))* bump pinia from 3.0.2 to 3.0.3 ([95fa45d](https://github.com/deploystackio/deploystack/commit/95fa45db712663ce1a9e6be48320480de51ae2f5))* bump prettier from 3.5.3 to 3.6.0 ([b49f98d](https://github.com/deploystackio/deploystack/commit/b49f98d44a0fd088e2251c7a20878aeb6582da74))* bump tailwind-merge from 3.3.0 to 3.3.1 ([055e26c](https://github.com/deploystackio/deploystack/commit/055e26c7d077d3c0b8af83a4c9e0c986a99b09c5))* bump ts-jest from 29.3.4 to 29.4.0 ([574f595](https://github.com/deploystackio/deploystack/commit/574f595fa62aafb0d0cf6e81ce80e2132f39493a))* bump typescript-eslint from 8.33.0 to 8.34.1 ([ca1c730](https://github.com/deploystackio/deploystack/commit/ca1c7307c4a572095357888f15b55e076559edef))* bump typescript-eslint from 8.34.1 to 8.35.0 ([a40c66e](https://github.com/deploystackio/deploystack/commit/a40c66ead2d0dc9a5aef2560a395e69e9d7fa2a1))* bump vee-validate from 4.15.0 to 4.15.1 ([bb4ae92](https://github.com/deploystackio/deploystack/commit/bb4ae921131dc54257d9b6b7a835674f004cf69b))* bump vite-plugin-vue-devtools from 7.7.6 to 7.7.7 ([56b7aea](https://github.com/deploystackio/deploystack/commit/56b7aeaad311bfe5d9ff739933ae9ef37ea67aa6))* bump vitest from 2.1.9 to 3.2.3 ([13a744e](https://github.com/deploystackio/deploystack/commit/13a744edf756e44b48c09370a09c463ffcb1635e))* bump vue from 3.5.16 to 3.5.17 ([a099ccb](https://github.com/deploystackio/deploystack/commit/a099ccba8b1ffb66b3efca12a12485492a6ae4dc))* bump vue-i18n from 11.1.5 to 11.1.7 ([617761b](https://github.com/deploystackio/deploystack/commit/617761b40d4274d1c90874fa19f0fba742d80599))* bump zod from 3.25.49 to 3.25.65 ([5fd7dd6](https://github.com/deploystackio/deploystack/commit/5fd7dd6279f5b2dfb19c19fc8d0564e819a65655))* bump @types/jest in /services/backend ([9ec4510](https://github.com/deploystackio/deploystack/commit/9ec451030a13020a4c4eff83e1786e01dd222976))* bump better-sqlite3 in /services/backend ([c995299](https://github.com/deploystackio/deploystack/commit/c9952994def13b8abe715d20be668423a4a0fcda))* bump jest from 29.7.0 to 30.0.0 in /services/backend ([d961505](https://github.com/deploystackio/deploystack/commit/d961505df111257c15bf098bdcdb0a095fb53f60))* release v0.20.5 ([284dcbc](https://github.com/deploystackio/deploystack/commit/284dcbccd20ea64e85411f45941ce287d12bfcc2))* clean up comments in AppSidebar and DashboardLayout components for clarity ([7e798dd](https://github.com/deploystackio/deploystack/commit/7e798dd32f4cec3f90482382d26c4ba5d8abdb21))* enhance sidebar spacer behavior for expanded and collapsed states in DashboardLayout component ([1bc4a83](https://github.com/deploystackio/deploystack/commit/1bc4a83abf64ed5e2b1f7dae625dd60946dd89a3))* improve sidebar layout and CSS variable handling in DashboardLayout component ([9d0986a](https://github.com/deploystackio/deploystack/commit/9d0986a0f47a6cce7ed715fae5b8fb32ff10ef4f))* remove console logs and unused form validation logic in GlobalSettings component ([23b6d7f](https://github.com/deploystackio/deploystack/commit/23b6d7fac649e6bee94dc64818ba79a0a0e887b7))* remove console logs for cleaner code in GlobalSettings component ([a23a4bb](https://github.com/deploystackio/deploystack/commit/a23a4bb8a3a92f950b9b18b1dacc7a8669c24de6))* remove deprecated users table columns and clean up schema definitions ([5169330](https://github.com/deploystackio/deploystack/commit/51693307f4dc54f7b7331b649cb4d56de4a8154a))* remove old team management views and implement new team management structure ([45561f0](https://github.com/deploystackio/deploystack/commit/45561f05748dc9eafd6a92829f6acbff89230cda))* remove unnecessary margin from sidebar in GlobalSettings component ([df8bba8](https://github.com/deploystackio/deploystack/commit/df8bba8b8f48f1c90c5701f225ff3a4fb82650bd))* remove unused Button import from AppSidebar component ([a19ce4a](https://github.com/deploystackio/deploystack/commit/a19ce4a5afaccb1e75820da828ae3bfefaec2659))* remove unused favicon import and update request handlers to use underscore for unused parameters ([9ee78fd](https://github.com/deploystackio/deploystack/commit/9ee78fddd2c8384045bd32a4f5d48a837891e202))* remove unused generateId import from globalSettingsService ([59e2c60](https://github.com/deploystackio/deploystack/commit/59e2c600d9a010a0bead022fbc4683dbc3d02a6f))* remove unused user registration route and example user fetching route from API ([e82e85d](https://github.com/deploystackio/deploystack/commit/e82e85dfdf632cf9a6550aa0095cea5d57a06d06))* remove users table and update database setup for persistence ([1eb9e4a](https://github.com/deploystackio/deploystack/commit/1eb9e4af13c2f686b16601fdb2b3326e35a65dc2))* rename 'email' to 'login' in authentication tests and login form for consistency ([161b0bf](https://github.com/deploystackio/deploystack/commit/161b0bfa5b0e53d794e60700422c926271c41b68))* replace Button with SidebarMenuButton in AppSidebar and update sidebar width variables in DashboardLayout ([031e128](https://github.com/deploystackio/deploystack/commit/031e128d407e11aa802103cd2dff1d0ebbd9f726))* replace forgot password button with router link for navigation ([269fa69](https://github.com/deploystackio/deploystack/commit/269fa6954d7b82718b2e607f25380bc5ed0588db))* Replace permission checks with global admin requirement in global settings route ([a2c36b0](https://github.com/deploystackio/deploystack/commit/a2c36b0cf2babed8ee8aec70596ad6e9ae1f8f48))* simplify defaultOpen handling and enhance sidebar accessibility with titles and descriptions ([63c2184](https://github.com/deploystackio/deploystack/commit/63c218462d48005c0b9f64345f7d04aaa146523d))* update formValues type to improve type safety and consistency in GlobalSettings component ([f46ff4e](https://github.com/deploystackio/deploystack/commit/f46ff4e5b348b7d020173f9d32e1e311caaf4e6e))* add @types/better-sqlite3 for improved TypeScript support and refactor database functions for clarity ([0dddbd0](https://github.com/deploystackio/deploystack/commit/0dddbd025a7332dd876ff0544a6608fc270b4561))* add change password endpoint for authenticated users ([c9a229b](https://github.com/deploystackio/deploystack/commit/c9a229b9163d720afcaa8af1bcf704eb4f247fb5))* add dashboard view with user data fetching and error handling ([d9fe33e](https://github.com/deploystackio/deploystack/commit/d9fe33e20cd302eb3f650ee76928928c8eaf074c))* add end-to-end tests for global settings access control and update test sequencer order ([64558e1](https://github.com/deploystackio/deploystack/commit/64558e1fd2b3c2b1e9b8026bb2bb89a18ce01e69))* add end-to-end tests for global settings initialization and access control ([a78bee5](https://github.com/deploystackio/deploystack/commit/a78bee5e6cc3eacb49ec7af00da6e17c4002edc3))* add endpoint to retrieve current user's default team ([3e42403](https://github.com/deploystackio/deploystack/commit/3e424032c915dbef1531e4abff4604d299c292ea))* add forgot password and reset password functionality with corresponding routes and localization ([60fa4f2](https://github.com/deploystackio/deploystack/commit/60fa4f2bc3438cf10c671cbfa33a86a91efc4b64))* add global settings check test to custom test sequencer order ([587a32a](https://github.com/deploystackio/deploystack/commit/587a32a5d1c99213624aa3f4f0d61c8d29a99198))* add global settings for application configuration and enable Swagger documentation control ([48e2a51](https://github.com/deploystackio/deploystack/commit/48e2a51f7c3940229d02181fb263ba986c5e5d36))* add global settings table and related permissions, update README and SECURITY documentation ([59ebf4f](https://github.com/deploystackio/deploystack/commit/59ebf4f5f994eb38e40c65daa58cf67d44209a9c))* add initial docker-compose configuration for backend and frontend services ([e0e3fd0](https://github.com/deploystackio/deploystack/commit/e0e3fd0fcbe140e4e4d96593d8f72c55ddfd49b4))* add setup success message to Setup view and update translations, remove unused imports in Users view ([c51425b](https://github.com/deploystackio/deploystack/commit/c51425b4dc6a41aaba25f59f60f664d6b6c8bec4))* Add Swagger documentation and API specification generation ([8753a48](https://github.com/deploystackio/deploystack/commit/8753a489947643fed799184b72f047bd22cf8aa2))* add table component suite with header, body, footer, and cell support ([e5c3671](https://github.com/deploystackio/deploystack/commit/e5c367133119f9834eb336b51254d490f9153c90))* add team and team membership functionality ([b0f485a](https://github.com/deploystackio/deploystack/commit/b0f485ad2ccc89d4fe51e7d3e3d20bb280863a5f))* add title for navigation in dashboard localization ([33d6e28](https://github.com/deploystackio/deploystack/commit/33d6e28b8422efec342cb8337f1e5c01200fc24c))* add type annotations and improve type safety in various components and services ([5314ea5](https://github.com/deploystackio/deploystack/commit/5314ea58ea356cea57d904e23250023ef9b42207))* add type support to settings and implement dynamic form handling for global settings ([9ef739e](https://github.com/deploystackio/deploystack/commit/9ef739e1c38d4f9fdd916178161a3d00ddb1bce4))* add user detail view and navigation from users list ([7449649](https://github.com/deploystackio/deploystack/commit/7449649a3f7953422d2f4a8384eae2cef401cf38))* add user management page and sidebar navigation, include internationalization support for admin users ([6f3789b](https://github.com/deploystackio/deploystack/commit/6f3789bc12c2ca1312316c11f3f112b9ac51e357))* add user teams management in UserDetail.vue and implement related API tests ([2e7efca](https://github.com/deploystackio/deploystack/commit/2e7efca5bda6e65fbff42cacc449586f7bcb2b7b))* add watcher to reset success alert on route changes in GlobalSettings component ([0a807f2](https://github.com/deploystackio/deploystack/commit/0a807f297be846ff210bb14371b468d66c9268c6))* Enhance API documentation and response schemas for GitHub auth, global settings, and roles ([da94544](https://github.com/deploystackio/deploystack/commit/da945448f20129aced095622caff6c70ea3332a1))* enhance DashboardLayout and GlobalSettings components with improved sidebar and layout adjustments ([88b1e49](https://github.com/deploystackio/deploystack/commit/88b1e493ec89a28832cd37b3d653ce351db55d1a))* enhance global settings handling with proper type conversion for boolean and number values ([a3e1ec3](https://github.com/deploystackio/deploystack/commit/a3e1ec3e259707f40ea5a4b92c235716498ce7f4))* Enhance global settings with type support ([db3f61e](https://github.com/deploystackio/deploystack/commit/db3f61e6f983cc305100e132f05a6d1b602989c9))* enhance global setup by cleaning entire persistent_data directory before tests ([cd5177a](https://github.com/deploystackio/deploystack/commit/cd5177ae1bfd25218d98c2a6ea5256ebf9d82512))* enhance sidebar and sheet components with data slots and improved styling ([56ca7fb](https://github.com/deploystackio/deploystack/commit/56ca7fbdb0976857f07f8599707e72514c9e8643))* enhance success alert visibility and layout in GlobalSettings component ([99e8ae8](https://github.com/deploystackio/deploystack/commit/99e8ae8b3798e5859dc5e4c6810438e372adc079))* enhance user detail view with internationalization support and improved layout ([961c25d](https://github.com/deploystackio/deploystack/commit/961c25d6d967812f3a4466404e4fffb695aa9741))* Enhance users API with detailed response schemas and OpenAPI documentation ([a783208](https://github.com/deploystackio/deploystack/commit/a78320811837ab922687b7de8ddc4ba509e4caf5))* implement admin-initiated password reset functionality with email notification ([5c6345b](https://github.com/deploystackio/deploystack/commit/5c6345bdfd1fa2f9a4664cb0a2d808189f3f80c3))* implement alert dialog components and admin password reset functionality ([02325c9](https://github.com/deploystackio/deploystack/commit/02325c90282335e37892d871910faa5f8ea874fd))* implement AppSidebar and DashboardLayout components with user and team management features ([29eb7b7](https://github.com/deploystackio/deploystack/commit/29eb7b71a53257f5c14741fcb4ee71e20868ae93))* implement email verification system ([0b06feb](https://github.com/deploystackio/deploystack/commit/0b06feb92b23343ba9482330d84e1e9d9aef47d3))* implement global settings initialization and define GitHub OAuth and SMTP configuration modules ([5cd79cf](https://github.com/deploystackio/deploystack/commit/5cd79cf3571956846fb443da7e944b4781ed6998))* implement global settings management with group support and enhance UI alerts ([65909a1](https://github.com/deploystackio/deploystack/commit/65909a1ac4af2408a07d8707c1bf8a0679ce6896))* implement global settings page with role-based access, add not found page, and enhance user data fetching ([922994d](https://github.com/deploystackio/deploystack/commit/922994d9512bb86f8ddaa34862d0500844989d14))* implement logout functionality and enhance session management ([8e85ec4](https://github.com/deploystackio/deploystack/commit/8e85ec4354ac9208cf03bdf7777d16d3f2ecc184))* implement password change notification email and update user account routing ([40ab50a](https://github.com/deploystackio/deploystack/commit/40ab50a27e82dec9543a57ed2fdb31972e97cdd5))* implement password reset functionality with token management and email notifications ([4cd1fce](https://github.com/deploystackio/deploystack/commit/4cd1fcef867eadff2e9129aed3b8f0e381d13431))* implement plugin route structure and registration system for enhanced security and isolation ([9ea843e](https://github.com/deploystackio/deploystack/commit/9ea843e38c5043d0360df13def37ea9cca2ebc73))* implement plugin support for global settings, allowing plugins to define and manage their own settings and groups ([a1fbed4](https://github.com/deploystackio/deploystack/commit/a1fbed4f91ae46cb01e0aa0f673c9780a327ee2f))* implement smart caching for user and team services to optimize API calls and improve performance on public routes ([34dc0f0](https://github.com/deploystackio/deploystack/commit/34dc0f02493a1c6b78abe14145e5031c8357b9fa))* implement team management features with API integration ([bc403a3](https://github.com/deploystackio/deploystack/commit/bc403a3b29a8845b2f5d8c6f9a5fd45cb902ce1a))* implement team selection event handling and UI updates in Teams and AppSidebar components ([03f92c9](https://github.com/deploystackio/deploystack/commit/03f92c96ddaf40a8c2c9d0ec81671d1eaf3e94b9))* implement user authentication check in router and create UserService for fetching current user ([e48b5b9](https://github.com/deploystackio/deploystack/commit/e48b5b9170d5ce1e6f4bf69d1577350b3aeffa09))* implement user login via email/password and update API documentation ([86fba41](https://github.com/deploystackio/deploystack/commit/86fba4189c6f8e9163db45f64c16356201a7b342))* integrate zod and zod-to-json-schema for improved request/response validation in authentication routes ([7f96b3b](https://github.com/deploystackio/deploystack/commit/7f96b3bcec5b0135a69982d6caf39c28a33916a3))* refactor database schema management by consolidating schema definitions and removing legacy schema file ([3776fd0](https://github.com/deploystackio/deploystack/commit/3776fd07705f6e7a93b2b204ecb8bdd91c6dc7a3))* refactor global settings structure to use groups instead of categories, update related schemas and routes ([1d4b043](https://github.com/deploystackio/deploystack/commit/1d4b043fd3eb736aab4321c06a7f054a37385ef7))* replace dynamic schema generation with static schema import and enhance session validation logic ([6eaeaa8](https://github.com/deploystackio/deploystack/commit/6eaeaa8c574d32f160a8125538bae41e35330e0b))* restructure global settings route and update sidebar navigation, enhance GlobalSettings view with DashboardLayout ([f18b7ea](https://github.com/deploystackio/deploystack/commit/f18b7eacd48de81380f9d6eb6c5a4fb4cc7fcdd8))* streamline user registration by removing manual session creation and simplifying response handling ([149b356](https://github.com/deploystackio/deploystack/commit/149b3567311603b3e77f3110f251c6424fab42d3))* update admin settings route to include optional groupId parameter ([5bb7691](https://github.com/deploystackio/deploystack/commit/5bb7691fba0e047bd3cd096cdf1de68acc54f1a7))* update database configuration for test environment and refactor encryption key handling ([8f8fd2e](https://github.com/deploystackio/deploystack/commit/8f8fd2eca1e56887f483ce99ab891244dc364a68))* update database schema tests to use static schema module and remove unused imports ([77d01aa](https://github.com/deploystackio/deploystack/commit/77d01aa35a76e2ac5faf4401c3708da3cbc23e74))* update development environment with nodemon configuration and enhance Teams view styling ([9c4bb9c](https://github.com/deploystackio/deploystack/commit/9c4bb9c834667447863aa1b8f4bb2a9fdb71c16f))* update user and team service response handling and cache management ([e14cce4](https://github.com/deploystackio/deploystack/commit/e14cce43672778a9be210115126b4d004fe7c587))*  ([2b876c1](https://github.com/deploystackio/deploystack/commit/2b876c1c7d9b587229a7f6423f4d348eed750439))*  ([f5ccdf4](https://github.com/deploystackio/deploystack/commit/f5ccdf429fc7424159325bddc037678377f3cdcd))*  ([483fe3c](https://github.com/deploystackio/deploystack/commit/483fe3c0a14c274a5f385afb90f05949abc23af3))*  ([3d9d7bd](https://github.com/deploystackio/deploystack/commit/3d9d7bdfcf7425c24a6fc26223eedaddb7f5b951))*  ([40cac89](https://github.com/deploystackio/deploystack/commit/40cac89fada5e19cd68ab295b9cdbc7f7eb207c0))*  ([1417891](https://github.com/deploystackio/deploystack/commit/1417891297d56830fec1444941e5e0fa02369ff8))*  ([2b84cfa](https://github.com/deploystackio/deploystack/commit/2b84cfa97f41f7c00d141bc32375cd485bb34fad))*  ([8335923](https://github.com/deploystackio/deploystack/commit/8335923542ea5f16a57a8ea0c9f7dc34c260ae4c))*  ([51cfe4b](https://github.com/deploystackio/deploystack/commit/51cfe4bb61c0fc55e93513a29c53536aba51bc48))* refactor console logging in deleteDbConfig tests for clarity and consistency ([1b255be](https://github.com/deploystackio/deploystack/commit/1b255be5d6c427b266d4c9bb78b9d3c400fbe596))* update API documentation and plugin security features for clarity and consistency ([c99184e](https://github.com/deploystackio/deploystack/commit/c99184e8c5e15e4d8f9b4f6d11363889ac5cc161))* Update API documentation for clarity and formatting improvements ([83abf19](https://github.com/deploystackio/deploystack/commit/83abf192406b37c112eafd9010af6b91e6aef8fa))* update documentation for global settings and email integration with improved formatting ([7e689d5](https://github.com/deploystackio/deploystack/commit/7e689d56ec8b68ad7f051aac2b582d2ca117f49e))* add missing line breaks in Docker command examples for clarity ([1ef1ca4](https://github.com/deploystackio/deploystack/commit/1ef1ca438e315113d03e56d273fc7adc89b8cf22))* avoid modifying immutable commit object in release-it transform ([08e93f4](https://github.com/deploystackio/deploystack/commit/08e93f4ec6ac056f3db45f9333c72884cb83861d))* correct plugin paths configuration for better clarity and maintainability ([06d5bb8](https://github.com/deploystackio/deploystack/commit/06d5bb8d961ef351908cf18dcbc0c90b9e8bf80a))* enhance error handling for database connection and update error messages ([b255245](https://github.com/deploystackio/deploystack/commit/b25524556ed0aa92b3873f2460d1f9cd622f8e5f))* enhance frontend release workflow with improved dependency installation and build handling ([4eaca2e](https://github.com/deploystackio/deploystack/commit/4eaca2e3658460096e06bc8c16070d664ebb153a))* hardcode GitHub repository URL in commit links for changelog ([199befb](https://github.com/deploystackio/deploystack/commit/199befb4e363e634f4307602284d91d6ea5aab01))* improve frontend release workflow with enhanced dependency installation and release notes extraction ([d50e10a](https://github.com/deploystackio/deploystack/commit/d50e10a846f93380d3f31201bc1557934bbede59))* remove unnecessary dbInstance parameter from createPluginTables call ([eaad7c3](https://github.com/deploystackio/deploystack/commit/eaad7c375dd0a0b912ab260fdcdf28da54f9ba5d))* remove unnecessary empty markdown link cleanup from workflows ([ab446cb](https://github.com/deploystackio/deploystack/commit/ab446cbd30748e4ca068f42f7d1fa3bf434bd815))* update API URL references to use VITE_DEPLOYSTACK_BACKEND_URL in AppSidebar and TeamService components ([82ce3c4](https://github.com/deploystackio/deploystack/commit/82ce3c499049b150cba5608dd9002e3c922f51dd))* update API URL to use VITE_DEPLOYSTACK_BACKEND_URL in Login and Register components ([1b3477a](https://github.com/deploystackio/deploystack/commit/1b3477abd4aedc8bd657c9e552e94cee34e71c01))* update base URL and enhance fetch requests with session management ([d164940](https://github.com/deploystackio/deploystack/commit/d1649403c4d38206ec5d6f1db08d7df974933075))* update conventional changelog plugin configuration for backend and frontend ([bbcfbf4](https://github.com/deploystackio/deploystack/commit/bbcfbf4da3edec1de943605fa1482aa6bab5b9fd))* update Docker run command for frontend environment variables ([348b77a](https://github.com/deploystackio/deploystack/commit/348b77aaf69c170e6e57184406270e9e55c728ac))* update Docker run command to map port 8080 to 80 for frontend ([538d5fc](https://github.com/deploystackio/deploystack/commit/538d5fc28f8e3b74fa6b71cf112e328ec0d97f57))* update environment variable names for frontend and backend URLs in Docker commands and CORS configuration ([07111a4](https://github.com/deploystackio/deploystack/commit/07111a4a75ea1d23ac9e0f3a6a75745e0d87bc7f))* update error handling to include Bad Request status for invalid credentials ([a6f4e00](https://github.com/deploystackio/deploystack/commit/a6f4e00b7c1847c46cc13b3f6367cb255ec47575))* update ESLint configuration to ignore temporary TypeScript files and remove unused type imports in global settings and plugin manager ([1ba2aaa](https://github.com/deploystackio/deploystack/commit/1ba2aaa34213ddada82b7ffaf49b1abb6d191fbc))* update favicon.ico for improved branding ([e5d3ba5](https://github.com/deploystackio/deploystack/commit/e5d3ba5b0744ee05ac7253ca2538bff06a16e6ac))* update release-it configuration to properly format commit links in changelog ([aa00be1](https://github.com/deploystackio/deploystack/commit/aa00be14bec205d77f85cd167c9d05cea6ee2914))* update storage key handling in DatabaseService to use dynamic baseUrl ([9b613f5](https://github.com/deploystackio/deploystack/commit/9b613f5d4633f1b89fcdb08f1274c6dce43ff088))* update timestamp creation to use Date object instead of Date.now() in createGroups method ([4f163de](https://github.com/deploystackio/deploystack/commit/4f163defb4d88e3db1c59f5caed1919c1d239860))* use proper URL template variables for commit links in changelog ([8c6f600](https://github.com/deploystackio/deploystack/commit/8c6f6003c70e2076def308f1fa4bba6565912920))* wrap boolean switch in a div for consistent layout in settings form ([f29abcf](https://github.com/deploystackio/deploystack/commit/f29abcf70e37527f290a53d89e31f1a81fd3d4d2))* enhance button cursor styles and remove test environment display from login component ([02c26fd](https://github.com/deploystackio/deploystack/commit/02c26fd1c81d863bc91ab9d45ed4a968e8475971))* update environment variable references to use VITE_DEPLOYSTACK_APP_URL ([d7361d5](https://github.com/deploystackio/deploystack/commit/d7361d562a0a22569cc910fd422bdb91318b6595))

## [0.20.5](https://github.com/deploystackio/deploystack/compare/backend-v0.20.4...backend-v0.20.5) (2025-05-31)


### fix

* enhance error handling for database connection and update error messages ([](https://github.com/deploystackio/deploystack/commit/b25524556ed0aa92b3873f2460d1f9cd622f8e5f))
* enhance frontend release workflow with improved dependency installation and build handling ([](https://github.com/deploystackio/deploystack/commit/4eaca2e3658460096e06bc8c16070d664ebb153a))
* improve frontend release workflow with enhanced dependency installation and release notes extraction ([](https://github.com/deploystackio/deploystack/commit/d50e10a846f93380d3f31201bc1557934bbede59))
* update conventional changelog plugin configuration for backend and frontend ([](https://github.com/deploystackio/deploystack/commit/bbcfbf4da3edec1de943605fa1482aa6bab5b9fd))
* update Docker run command for frontend environment variables ([](https://github.com/deploystackio/deploystack/commit/348b77aaf69c170e6e57184406270e9e55c728ac))
* update Docker run command to map port 8080 to 80 for frontend ([](https://github.com/deploystackio/deploystack/commit/538d5fc28f8e3b74fa6b71cf112e328ec0d97f57))
* update environment variable names for frontend and backend URLs in Docker commands and CORS configuration ([](https://github.com/deploystackio/deploystack/commit/07111a4a75ea1d23ac9e0f3a6a75745e0d87bc7f))
* update favicon.ico for improved branding ([](https://github.com/deploystackio/deploystack/commit/e5d3ba5b0744ee05ac7253ca2538bff06a16e6ac))
* update storage key handling in DatabaseService to use dynamic baseUrl ([](https://github.com/deploystackio/deploystack/commit/9b613f5d4633f1b89fcdb08f1274c6dce43ff088))


### frontend

* update environment variable references to use VITE_DEPLOYSTACK_APP_URL ([](https://github.com/deploystackio/deploystack/commit/d7361d562a0a22569cc910fd422bdb91318b6595))

## [0.20.4](https://github.com/deploystackio/deploystack/compare/backend-v0.20.2...backend-v0.20.4) (2025-05-30)


### chore

* **backend:** release v0.20.3 ([](https://github.com/deploystackio/deploystack/commit/5e30962bbb84dd16e035abedc8101770d09c113b))
* update backend version to 0.20.2 and typescript-eslint to 8.33.0 ([](https://github.com/deploystackio/deploystack/commit/bc015afd966ad8b304c619e00de57d57dcf583b8))

## [0.20.3](https://github.com/deploystackio/deploystack/compare/backend-v0.20.2...backend-v0.20.3) (2025-05-30)


### chore

* update backend version to 0.20.2 and typescript-eslint to 8.33.0 ([](https://github.com/deploystackio/deploystack/commit/bc015afd966ad8b304c619e00de57d57dcf583b8))

## 0.20.2 (2025-05-30)


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
* **backend:** bump drizzle-orm in /services/backend ([](https://github.com/deploystackio/deploystack/commit/b9c7cdc94beda62da778e6699dba6baabc1d9ac2))
* **backend:** release v0.20.0 ([](https://github.com/deploystackio/deploystack/commit/6285c22ed20e8ea5a96ab2a7df46c41910d54f34))
* **backend:** release v0.20.1 ([](https://github.com/deploystackio/deploystack/commit/0c6fd1eb40aae32543e3671b28a549f79e5f2911))


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
* enhance release notes extraction in backend release workflow ([](https://github.com/deploystackio/deploystack/commit/838a2b7e982014fb287c5c58f97d562e98bc17aa))
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

## 0.20.1 (2025-05-30)


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
* **backend:** bump drizzle-orm in /services/backend ([](https://github.com/deploystackio/deploystack/commit/b9c7cdc94beda62da778e6699dba6baabc1d9ac2))
* **backend:** release v0.20.0 ([](https://github.com/deploystackio/deploystack/commit/6285c22ed20e8ea5a96ab2a7df46c41910d54f34))


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
* enhance release notes extraction in backend release workflow ([](https://github.com/deploystackio/deploystack/commit/838a2b7e982014fb287c5c58f97d562e98bc17aa))
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

# 0.20.0 (2025-05-30)


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
* **backend:** bump drizzle-orm in /services/backend ([](https://github.com/deploystackio/deploystack/commit/b9c7cdc94beda62da778e6699dba6baabc1d9ac2))


### docs

* update database setup instructions and clarify persistent data directory usage ([](https://github.com/deploystackio/deploystack/commit/59bec6fab64ce94c472b0a4c3047be2842fdc3bc))


### feat

* add CORS support and database setup functionality ([](https://github.com/deploystackio/deploystack/commit/35e30a6eb1a3cbf528e9d9d729de868d9377fb8c))
* add CORS support and database setup functionality ([](https://github.com/deploystackio/deploystack/commit/02e0c63e0eb3dacbfb079073c70b5b596695355c))
* enhance database schema and authentication flow with foreign key constraints and session management improvements ([](https://github.com/deploystackio/deploystack/commit/55745474a9c0604c67499c2c48dc420f856ecaf1))


### fix

* add overrides for esbuild version in package.json ([](https://github.com/deploystackio/deploystack/commit/d40d6fa515b4962033fd0869970370c98df8aaa5))
* add permissions for issues in backend release workflow ([](https://github.com/deploystackio/deploystack/commit/de0d463e0dd5c6eac8eafd621d88e7821b457138))
* clean up empty markdown links and remove empty lines from release notes extraction ([](https://github.com/deploystackio/deploystack/commit/a3d1c14474b5ecfc94f87ec3ecd295954d732d5e))
* correct formatting in package.json overrides section ([](https://github.com/deploystackio/deploystack/commit/021f5b218e6071fba2216a9c9e3b3563b8693e99))
* enhance error handling in login and registration forms with improved type safety and user feedback ([](https://github.com/deploystackio/deploystack/commit/d3f9fc74f0f2981cf67eb9b7ee1fa4d7b3995351))
* enhance release notes extraction in backend release workflow ([](https://github.com/deploystackio/deploystack/commit/838a2b7e982014fb287c5c58f97d562e98bc17aa))
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
