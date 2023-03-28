const path = require('path');
const CopyWebpackPlugin = require('copy-webpack-plugin');
const VERSION = require('./version');
module.exports = {
    devtool: 'source-map',
    mode: 'development',
    entry: './src/index.ts',
    output: {
        path: path.resolve(__dirname, 'dist'),
        filename: 'panoroma.min.js',
        publicPath: '/dist/',
        library: {
            type: 'umd',
            export: 'default',
            umdNamedDefine: true,
            name: 'PanoromaJS',
        },
    },
    module: {
        rules: [
            {
                test: /\.(tsx|ts|js)$/,
                exclude: /(node_modules)/,
                use: [
                    {
                        loader: 'ts-loader',
                    },
                ],
            },
        ],
    },
    resolve: {
        alias: {
            '@': path.resolve(__dirname, './src'),
        },
        extensions: ['.ts', '.js'],
    },
    plugins: [
        new CopyWebpackPlugin({
            patterns: [
                {
                    from: 'src/package.json',
                    to: path.resolve(__dirname, 'dist'),
                    transform: {
                        transformer(content, absoluteFrom) {
                            return content
                                .toString('utf8')
                                .replace('_index_to_version', VERSION);
                        }
                    }
                },
            ],
        }),
    ],
};
