module.exports = {
  git: {
    commitMessage: 'chore(backend): release v${version}',
    tagName: 'backend-v${version}',
    tagAnnotation: 'Backend Release ${version}',
    commitsPath: 'services/backend',
    addUntrackedFiles: false,
    requireCleanWorkingDir: false
  },
  npm: {
    publish: false
  },
  github: {
    release: true,
    releaseName: 'Backend v${version}'
  },
  plugins: {
    '@release-it/conventional-changelog': {
      preset: 'angular',
      infile: 'CHANGELOG.md',
      whatBump: false,
      writerOpts: {
        transform: (commit) => {
          // Exclude release commits from changelog
          if (commit.type === 'chore' && commit.subject && commit.subject.startsWith('release v')) {
            return;
          }
          // Only include backend and all scoped commits
          if (commit.scope && (commit.scope === 'backend' || commit.scope === 'all')) {
            return commit;
          }
          // Exclude all other commits
          return;
        }
      }
    }
  }
};
