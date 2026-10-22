const { NxAppWebpackPlugin } = require('@nx/webpack/app-plugin');
const { join } = require('path');

module.exports = {
  externals: {
    ioredis: 'commonjs ioredis',
    helmet: 'commonjs helmet',
    yauzl: 'commonjs yauzl',
    '@prisma/client': 'commonjs @prisma/client',
    '@aws-sdk/client-s3': 'commonjs @aws-sdk/client-s3',
    '@aws-sdk/s3-request-presigner': 'commonjs @aws-sdk/s3-request-presigner',
  },
  output: {
    path: join(__dirname, 'dist'),
    clean: true,
    ...(process.env.NODE_ENV !== 'production' && {
      devtoolModuleFilenameTemplate: '[absolute-resource-path]',
    }),
  },
  plugins: [
    new NxAppWebpackPlugin({
      target: 'node',
      compiler: 'tsc',
      main: './src/main.ts',
      tsConfig: './tsconfig.app.json',
      assets: ['./src/assets'],
      optimization: false,
      outputHashing: 'none',
      generatePackageJson: false,
      sourceMap: true,
    }),
  ],
};
