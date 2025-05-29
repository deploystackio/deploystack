# Release Process

This document outlines the release process for the DeployStack application. We maintain separate versioning for our frontend and backend services, which allows us to release updates independently.

## Table of Contents

- [Release Workflows](#release-workflows)
- [Creating a Release](#creating-a-release)
  - [Automated PR-Based Release](#automated-pr-based-release)
  - [Manual Release](#manual-release)
- [Version Numbering](#version-numbering)
- [Release Artifacts](#release-artifacts)
- [Troubleshooting](#troubleshooting)

## Release Workflows

DeployStack uses [release-it](https://github.com/release-it/release-it) to automate our release process. Each service (frontend and backend) has its own release configuration and GitHub workflows.

Our release process follows these steps:

1. **Version Bump**: Update version numbers in package.json
2. **Changelog Generation**: Automatically update CHANGELOG.md based on commit messages
3. **Git Operations**: Create git tag, commit version changes
4. **GitHub Release**: Create a GitHub release with release notes
5. **Notifications**: Notify team of successful release

## Creating a Release

There are two methods to create a release:

### Automated PR-Based Release

This is the recommended approach for team environments:

1. Go to the GitHub Actions tab in the repository
2. Select either "Frontend Release PR" or "Backend Release PR" workflow
3. Click "Run workflow"
4. Select options:
   - **Type**: auto (based on commit messages), patch, minor, or major
   - **Beta**: Whether this is a pre-release
5. Run the workflow
6. Review the automatically created PR
7. Merge the PR to trigger the actual release

The PR-based approach allows for:

- Team review before release
- Additional testing
- Documentation updates
- Final approval process

### Manual Release

For immediate releases without the PR review process:

1. Go to the GitHub Actions tab in the repository
2. Select either "Manual Frontend Release" or "Manual Backend Release" workflow
3. Click "Run workflow"
4. Select the version increment type and whether it's a beta release
5. Run the workflow

This approach will immediately:

- Bump the version
- Update the changelog
- Create a git tag
- Push to GitHub
- Create a GitHub release

## Version Numbering

We follow Semantic Versioning (SemVer):

- **Major** (1.0.0): Incompatible API changes
- **Minor** (0.1.0): Add functionality in a backward-compatible manner
- **Patch** (0.0.1): Backward-compatible bug fixes
- **Pre-release** (1.0.0-beta.1): Pre-release versions

Each service (frontend and backend) maintains its own version number.

## Release Artifacts

Each release creates:

1. Git tag (prefixed with service name)
2. Updated CHANGELOG.md
3. GitHub release with release notes
4. Version bump in package.json
5. Docker images with appropriate version tags:
   - `deploystack/frontend:latest`
   - `deploystack/frontend:v{version}`
   - `deploystack/backend:latest`
   - `deploystack/backend:v{version}`

## Troubleshooting

Common issues and solutions:

### Release Job Is Skipped

If using the PR-based approach, ensure your PR has both:

- The correct service label (`frontend` or `backend`)
- The `release` label

### Changelog Not Generated Correctly

Ensure your commit messages follow the Angular convention with proper scopes as detailed in [CONTRIBUTING.md](CONTRIBUTING.md). Only certain commit types (feat, fix, perf) will appear in the changelog by default.

If commits appear in the wrong changelog, check that you're using the correct scope in your commit messages (e.g., `frontend`, `backend`).

### Configuration Files

We use JavaScript-based configuration files (`.release-it.js`) instead of JSON to support advanced filtering of commits by scope. If you need to modify the release configuration, edit these files rather than looking for JSON files.
