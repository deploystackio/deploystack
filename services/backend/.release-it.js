module.exports = {
  "git": {
    "commitMessage": "chore(backend): release v${version}",
    "tagName": "backend-v${version}",
    "tagAnnotation": "Backend Release ${version}",
    "addUntrackedFiles": "false"
  },
  "github": {
    "release": true,
    "releaseName": "Backend v${version}"
  },
  "npm": {
    "publish": false
  },
  "hooks": {
    "before:init": ["npm run lint"],
    "after:bump": "npm run build",
    "after:release": "echo 'Backend ${version} released!'"
  },
  "plugins": {
    "@release-it/conventional-changelog": {
      "preset": {
        "name": "angular"
      },
      "infile": "CHANGELOG.md",
      "ignoreRecommendedBump": true,
      "path": "services/backend",
      "writerOpts": {
        "commitsFilter": ["feat", "fix", "perf", "revert"],
        "transform": function(commit, context) {
          // Only include commits with backend scope or no scope
          const scopes = commit.scope ? commit.scope.split(',') : [];
          if (commit.scope && !scopes.includes('backend') && !scopes.includes('all')) {
            return;
          }
          
          // Ensure commit hash is available for link text
          if (commit.hash) {
            commit.shortHash = commit.hash.substring(0, 7);
          }
          
          return commit;
        },
        "commitPartial": "* {{subject}} ([{{shortHash}}]({{commitUrlFormat}}))"
      }
    }
  }
};
