module.exports = {
  "git": {
    "commitMessage": "chore(frontend): release v${version}",
    "tagName": "frontend-v${version}",
    "tagAnnotation": "Frontend Release ${version}",
    "addUntrackedFiles": "false"
  },
  "github": {
    "release": true,
    "releaseName": "Frontend v${version}"
  },
  "npm": {
    "publish": false
  },
  "hooks": {
    "before:init": ["npm run lint"],
    // Only run build when NOT in CI mode (i.e., during actual release merge)
    // During PR creation (CI=true), skip build to avoid rollup issues
    "after:bump": process.env.CI ? [] : ["npm run build"],
    "after:release": "echo 'Frontend ${version} released!'"
  },
  "plugins": {
    "@release-it/conventional-changelog": {
      "preset": "angular",
      "infile": "CHANGELOG.md",
      "ignoreRecommendedBump": true,
      "commitPath": ".",
      "writerOpts": {
        "commitsFilter": ["feat", "fix", "perf", "revert"],
        "transform": function(commit) {
          // Only include commits with frontend scope or no scope
          const scopes = commit.scope ? commit.scope.split(',') : [];
          if (commit.scope && !scopes.includes('frontend') && !scopes.includes('all')) {
            return;
          }
          return commit;
        }
      }
    }
  }
};
