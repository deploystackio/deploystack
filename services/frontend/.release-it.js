module.exports = {
  git: {
    commitMessage: 'chore(frontend): release v${version}',
    tagName: 'frontend-v${version}',
    tagAnnotation: 'Frontend Release ${version}',
    commitsPath: 'services/frontend',
    addUntrackedFiles: false,
    requireCleanWorkingDir: false
  },
  github: {
    release: true,
    releaseName: 'Frontend v${version}'
  },
  npm: {
    publish: false
  },
  hooks: {
    'before:init': ['npm run lint'],
    'after:bump': process.env.CI ? [] : ['npm run build'],
    'after:release': 'echo \'Frontend ${version} released!\''
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
            return false;
          }
          return commit;
        }
      }
    }
  }
};
