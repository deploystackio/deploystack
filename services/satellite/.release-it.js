module.exports = {
  git: {
    commitMessage: 'chore(satellite): release v${version}',
    tagName: 'satellite-v${version}',
    tagAnnotation: 'Satellite Release ${version}',
    commitsPath: 'services/satellite',
    addUntrackedFiles: false,
    requireCleanWorkingDir: false
  },
  npm: {
    publish: false
  },
  github: {
    release: true,
    releaseName: 'Satellite v${version}'
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
