const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const nodeExternals = require('webpack-node-externals');

const bundlePath = path.resolve(__dirname, 'bundle');
const srcPath = path.resolve(__dirname, 'src');

const resolveExtensions = [
    '.tsx', '.ts', '.js', '.scss', '.css'
];

module.exports = [
    {
        entry: './src/main.ts',
        resolve: {
            extensions: resolveExtensions
        },
        output: {
            path: bundlePath,
            filename: "main.js"
        },
        devtool: 'source-map',
        target: "electron-main",
        module: {
            rules: [{
                test: /\.ts$/,
                include: srcPath,
                use: [{ loader: 'ts-loader' }]
            }]
        }
    },
    {
        entry: './src/index.tsx',
        resolve: {
            extensions: resolveExtensions
        },
        output: {
            path: bundlePath,
            filename: "index.js"
        },
        devtool: 'source-map',
        target: "electron-renderer",
        optimization: {
            splitChunks: {
                chunks: 'all'
            }
        },
        module: {
            rules: [{
                test: /\.tsx?$/,
                use: [{ loader: 'ts-loader' }]
            }, {
                test: /\.(sa|sc|c)ss$/,
                use: ['style-loader', 'css-loader', 'sass-loader']
            }, {
                test: /\.(woff(2)?|ttf|eot|svg)(\?v=\d+\.\d+\.\d+)?$/,
                use: [
                    {
                        loader: 'file-loader',
                        options: {
                            name: '[name].[ext]',
                            outputPath: 'fonts/'
                        }
                    }
                ]
            }]
        },
        plugins: [
            new HtmlWebpackPlugin({
                template: path.resolve(srcPath, "index.html")
            })
        ]
    },{
        entry: './src/console/console-main.ts',
        resolve: {
            extensions: resolveExtensions
        },
        output: {
            path: bundlePath,
            filename: "console-main.js"
        },
        devtool: 'source-map',
        target: "node",
        externals: [
            nodeExternals()
        ],
        module: {
            rules: [{
                test: /\.ts$/,
                include: srcPath,
                use: [{ loader: 'ts-loader' }]
            }]
        }
    },
];
