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
