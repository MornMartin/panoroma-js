const path = require('path');
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
};
