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
    release: false
  },
  plugins: {
    '@release-it/conventional-changelog': {
      preset: {
        name: 'angular'
      },
      infile: 'CHANGELOG.md',
      ignoreRecommendedBump: true
    }
  }
};
