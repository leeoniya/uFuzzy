const fs = require('fs');

import { terser } from 'rollup-plugin-terser';

const pkg = JSON.parse(fs.readFileSync('./package.json', 'utf8'));
const ver = "v" + pkg.version;
const urlVer = "https://github.com/leeoniya/uFuzzy (" + ver + ")";
const banner = [
	"/**",
	"* Copyright (c) " + new Date().getFullYear() + ", Leon Sorokin",
	"* All rights reserved. (MIT Licensed)",
	"*",
	"* uFuzzy.js (μFuzzy)",
	"* A tiny, efficient fuzzy matcher that doesn't suck",
	"* " + urlVer,
	"*/",
	"",
].join("\n");

function bannerlessESM() {
	return {
		name: 'stripBanner',
		resolveId(importee) {
			if (importee == 'uFuzzy')
				return importee;
			return null;
		},
		load(id) {
			if (id == 'uFuzzy')
				return fs.readFileSync('./dist/uFuzzy.esm.js', 'utf8').replace(/\/\*\*.*?\*\//gms, '');
			return null;
		}
	};
}

const terserOpts = {
	compress: {
		inline: 0,
		passes: 2,
		keep_fargs: false,
		pure_getters: true,
		unsafe: true,
		unsafe_comps: true,
		unsafe_math: true,
		unsafe_undefined: true,
	},
	output: {
		comments: /^!/
	}
};

export default [
	{
		input: './src/uFuzzy.js',
		output: {
			name: 'uFuzzy',
			file: './dist/uFuzzy.esm.js',
			format: 'es',
			banner,
		},
	},
	{
		input: './src/uFuzzy.js',
		output: {
			name: 'uFuzzy',
			file: './dist/uFuzzy.cjs.js',
			format: 'cjs',
			exports: "auto",
			banner,
		},
	},
	{
		input: 'uFuzzy',
		output: {
			name: 'uFuzzy',
			file: './dist/uFuzzy.iife.js',
			format: 'iife',
			esModule: false,
			banner,
		},
		plugins: [
			bannerlessESM(),
		]
	},
	{
		input: 'uFuzzy',
		output: {
			name: 'uFuzzy',
			file: './dist/uFuzzy.iife.min.js',
			format: 'iife',
			esModule: false,
			banner: "/*! " + urlVer + " */",
		},
		plugins: [
			bannerlessESM(),
			terser(terserOpts),
		]
	},
];