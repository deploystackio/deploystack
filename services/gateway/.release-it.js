module.exports = {
  "git": {
    "commitMessage": "chore(gateway): release v${version}",
    "tagName": "gateway-v${version}",
    "tagAnnotation": "Gateway Release ${version}",
    "addUntrackedFiles": false,
    // Ensure we're working from the correct directory
    "requireCleanWorkingDir": false
  },
  "github": {
    "release": true,
    "releaseName": "Gateway v${version}"
  },
  "npm": {
    "publish": false // We handle npm publishing separately in the workflow
  },
  "hooks": {
    "before:init": ["npm run lint"],
    // Only run build when NOT in CI mode (i.e., during actual release merge)
    // During PR creation (CI=true), skip build to avoid rollup issues
    "after:bump": process.env.CI ? [] : ["npm run build"],
    "after:release": "echo 'Gateway ${version} released!'"
  },
  "plugins": {
    "@release-it/conventional-changelog": {
      "preset": {
        "name": "angular"
      },
      "infile": "CHANGELOG.md",
      "ignoreRecommendedBump": true,
      "path": "services/gateway",
      "writerOpts": {
        "commitsFilter": ["feat", "fix", "perf", "revert"],
        "transform": function(commit, context) {
          // Only include commits with gateway scope, all scope, or no scope
          const scopes = commit.scope ? commit.scope.split(',').map(s => s.trim().toLowerCase()) : [];
          
          // If commit has a scope, it must include 'gateway' or 'all'
          if (commit.scope && !scopes.includes('gateway') && !scopes.includes('all')) {
            return; // Filter out commits not related to gateway
          }
          
          // Create a new commit object to avoid modifying immutable object
          const newCommit = Object.assign({}, commit);
          
          // Ensure commit hash is available for link text
          if (newCommit.hash) {
            newCommit.shortHash = newCommit.hash.substring(0, 7);
          }
          
          return newCommit;
        },
        "commitPartial": "* {{subject}} ([{{shortHash}}](https://github.com/deploystackio/deploystack/commit/{{hash}}))\n"
      }
    }
  }
};
