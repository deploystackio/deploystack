module.exports = {
  "git": {
    "commitMessage": "chore(gateway): release v${version}",
    "tagName": "gateway-v${version}",
    "tagAnnotation": "Gateway Release ${version}",
    "addUntrackedFiles": "false"
  },
  "github": {
    "release": true,
    "releaseName": "Gateway v${version}"
  },
  "npm": {
    "publish": false // We handle npm publishing separately in the workflow
  },
  "hooks": {
    "before:init": ["echo 'Preparing gateway release...'"],
    "after:bump": "npm run build",
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
          // Only include commits with gateway scope or no scope
          const scopes = commit.scope ? commit.scope.split(',') : [];
          if (commit.scope && !scopes.includes('gateway') && !scopes.includes('all')) {
            return;
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
