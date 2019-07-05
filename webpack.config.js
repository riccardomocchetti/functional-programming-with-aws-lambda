const path = require('path')

module.exports = {
  mode: 'production',
  entry: './src/handlers.ts',
  target: 'node',
  module: {
    rules: [
      {
        test: /\.tsx?$/,
        use: 'ts-loader',
        exclude: /node_modules/
      }
    ]
  },
  resolve: {
    extensions: ['.tsx', '.ts', '.js']
  },
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: './main.js',
    libraryTarget: 'commonjs',
  },
};