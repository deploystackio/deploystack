module.exports = {
  git: {
    commitMessage: 'chore(gateway): release v${version}',
    tagName: 'gateway-v${version}',
    tagAnnotation: 'Gateway Release ${version}',
    addUntrackedFiles: false,
    requireCleanWorkingDir: false
  },
  github: {
    release: true,
    releaseName: 'Gateway v${version}'
  },
  npm: {
    publish: false
  },
  hooks: {
    'before:init': ['npm run lint'],
    'after:bump': process.env.CI ? [] : ['npm run build'],
    'after:release': 'echo \'Gateway ${version} released!\''
  },
  plugins: {
    '@release-it/conventional-changelog': {
      preset: {
        name: 'angular'
      },
      infile: 'CHANGELOG.md',
      ignoreRecommendedBump: true,
      gitRawCommitsOpts: {
        path: 'services/gateway'
      }
    }
  }
};
