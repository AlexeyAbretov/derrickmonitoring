// const webpack = require('webpack');
const path = require('path');

/*
 * We've enabled UglifyJSPlugin for you! This minifies your app
 * in order to load faster and run less javascript.
 *
 * https://github.com/webpack-contrib/uglifyjs-webpack-plugin
 *
 */

// const UglifyJSPlugin = require('uglifyjs-webpack-plugin');

module.exports = {
	entry: ['babel-polyfill', 'whatwg-fetch', './src/js/app.js'],

	output: {
		filename: 'app.js',
		path: path.resolve(__dirname, 'output')
	},

	module: {
		rules: [
			{
				test: /\.js$/,
				exclude: /node_modules/,
				loader: 'babel-loader',

				options: {
					presets: ['env']
				}
			}
		]
	},

	mode: 'development',
	devtool: 'source-map',

	// plugins: [new UglifyJSPlugin()]
};
