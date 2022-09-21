/**
* Copyright (c) 2022, Leon Sorokin
* All rights reserved. (MIT Licensed)
*
* uFuzzy.js (μFuzzy)
* A fuzzy matcher that doesn't suck
* https://github.com/leeoniya/uFuzzy (v0.0.1)
*/

'use strict';

const cmp = new Intl.Collator('en').compare;

const inf = Infinity;

const isInt = /\d/;

const OPTS = {
	// term segmentation & punct/whitespace merging
	interSplit: '[^A-Za-z0-9]+',
	intraSplit: '[A-Za-z][0-9]|[0-9][A-Za-z]|[a-z][A-Z]',

	strictPre: false,
	strictSuf: false,

	upperChars: '[A-Z]',
	lowerChars: '[a-z]',

	// allowance between terms
	interChars: '.',
	interLimit: inf,

	// allowance between chars in terms
	intraChars: '[\\w-]',
	intraLimit: 0,

	// max filtered matches before scoring kicks in
//	rankLimit: 1000,
	// should ranking compute matched substr ranges for highlighting
	withRanges: false,

	/*
	// term permutations for out-of-order
	oooLimit: 0,

	// diacritics list for needle/query prep, e.g. [/oóö/, /aá/]
	// https://github.com/motss/normalize-diacritics/blob/main/src/index.ts
	diacritics: [],
	*/

	// final sorting fn
	sort: (info, haystack, needle) => {
		let { idx, term, pre0, pre1, suf0, suf1, span, start, intra, inter } = info;

		return idx.map((v, i) => i).sort((ia, ib) => (
			// least char intra-fuzz (most contiguous)
			intra[ia] - intra[ib] ||
			// most prefix/suffix bounds, boosted by full term matches
			(
				(term[ib] + pre0[ib] + 0.5 * pre1[ib] + suf0[ib] + 0.5 * suf1[ib]) -
				(term[ia] + pre0[ia] + 0.5 * pre1[ia] + suf0[ia] + 0.5 * suf1[ia])
			) ||
			// highest density of match (least span)
		//	span[ia] - span[ib] ||
			// highest density of match (least term inter-fuzz)
			inter[ia] - inter[ib] ||
			// earliest start of match
			start[ia] - start[ib] ||
			// alphabetic
			cmp(haystack[idx[ia]], haystack[idx[ib]])
		));
	},
};

const lazyRepeat = (chars, limit) => (
	limit == 0   ? ''           :
	limit == 1   ? chars + '??' :
	limit == inf ? chars + '*?' :
	               chars + `{0,${limit}}?`
);

function uFuzzy(opts) {
	opts = Object.assign({}, OPTS, opts);

	let intraSplit = new RegExp(opts.intraSplit, 'g');
	let interSplit = new RegExp(opts.interSplit, 'g');

	const isUpper = new RegExp(opts.upperChars);

	const typeClassOf = char => isInt.test(char) ? '\\d' : isUpper.test(char) ? opts.upperChars : opts.lowerChars;

	const prepQuery = (query, capt = 0) => {
		// split on punct, whitespace, num-alpha, and upper-lower boundaries
		let parts = query.trim().replace(intraSplit, m => m[0] + ' ' + m[1]).split(interSplit);

		let intraCharsTpl = lazyRepeat(opts.intraChars, opts.intraLimit);

		// capture at char level
		if (capt == 2 && opts.intraLimit > 0) {
			// sadly, we also have to capture the inter-term junk via parenth-wrapping .*?
			// to accum other capture groups' indices for \b boosting during scoring
			intraCharsTpl = ')(' + intraCharsTpl + ')(';
		}

		// array of regexp tpls for each term
		let reTpl = parts.map(p => p.split('').join(intraCharsTpl));

		if (opts.strictPre)
			reTpl = reTpl.map(term => '(?<!' + typeClassOf(term[0]) + ')' + term);

		if (opts.strictSuf)
			reTpl = reTpl.map(term => term + '(?!' + typeClassOf(term.at(-1)) + ')');

		let interCharsTpl = lazyRepeat(opts.interChars, opts.interLimit);

		// capture at word level
		if (capt > 0) {
			// sadly, we also have to capture the inter-term junk via parenth-wrapping .*?
			// to accum other capture groups' indices for \b boosting during scoring
			reTpl = '(' + reTpl.join(')(' + interCharsTpl + ')(') + ')';
		}
		else
			reTpl = reTpl.join(interCharsTpl);

		return [new RegExp(reTpl, 'i'), parts];
	};

	const filter = (haystack, needle) => {

		let out = [];
		let [query] = prepQuery(needle);

		for (let i = 0; i < haystack.length; i++) {
			let item = haystack[i];
			query.test(item) && out.push(i);
		}

		return out;
	};

	let interBound = new RegExp(opts.interSplit);
	let intraBound = new RegExp(opts.intraSplit);

	const info = (idxs, haystack, needle) => {

		let [query, parts] = prepQuery(needle, 1);

		let queryR;

		if (opts.withRanges)
			[queryR] = prepQuery(needle, 2);

		let field = Array(idxs.length).fill(0);

		let info = {
			// idx in haystack
			idx: idxs,

			// start of match
			start: field.slice(),
			// length of match
		//	span: field.slice(),

			// contiguous (no fuzz) and bounded terms (intra=0, pre0/1, suf0/1)
			// excludes terms that are contiguous but have < 2 bounds (substrings)
			term: field.slice(),
			// contiguous chars matched (currently, from full terms)
		//	chars: field.slice(),

			// cumulative length of unmatched chars (fuzz) within span
			inter: field.slice(), // between terms
			intra: field.slice(), // between chars within terms

			// hard/soft prefix/suffix counts
			// e.g. MegaMan (pre0: 1, suf0: 1, pre1: 1, suf1: 1), Mega Man (pre0: 2, suf0: 2)
			// hard boundaries
			pre0: field.slice(),
			suf0: field.slice(),
			// soft boundaries
			pre1: field.slice(),
			suf1: field.slice(),

			ranges: opts.withRanges ? Array(idxs.length) : null,
		};

		for (let i = 0; i < idxs.length; i++) {
			let mhstr = haystack[idxs[i]];
			let m = mhstr.match(query);

			let idxAcc = m.index;
		//	let span = m[0].length;

			for (let j = 0, k = 1; j < parts.length; j++, k+=2) {
				let group = m[k].toLowerCase();
				let fullMatch = group == parts[j];

				if (!fullMatch) {
					// when intraLimit > 0 'test' query can match 'ttest' in 'fittest'
					// try an exact substring match to improve rank quality
					if (opts.intraLimit > 0) {
						let idxOf = group.indexOf(parts[j]);
						if (idxOf > -1) {
							fullMatch = true;
							idxAcc += idxOf;
							m[k] = m[k].slice(idxOf);

							if (j == 0) {
								m.index = idxAcc;
							//	span -= idxOf;
							}
						}
					}

					// TODO: use difference in group/part length to boost eSyms? or iSyms (inexact)
				}

				if (fullMatch) {
					// does group's left and/or right land on \b
					let lftCharIdx = idxAcc - 1;
					let rgtCharIdx = idxAcc + m[k].length;

					let isPre = true;
					let isSuf = true;

					// prefix info
					if (lftCharIdx == -1           || interBound.test(mhstr[lftCharIdx]))
						info.pre0[i]++;
					else if (intraBound.test(mhstr[lftCharIdx] + mhstr[lftCharIdx + 1]))
						info.pre1[i]++;
					else
						isPre = false;

					// suffix info
					if (rgtCharIdx == mhstr.length || interBound.test(mhstr[rgtCharIdx]))
						info.suf0[i]++;
					else if (intraBound.test(mhstr[rgtCharIdx - 1] + mhstr[rgtCharIdx]))
						info.suf1[i]++;
					else
						isSuf = false;

					if (isPre && isSuf)
						info.term[i]++;
				}
				else
					info.intra[i] += group.length - parts[j].length; // intraFuzz

				if (j > 0)
					info.inter[i] += m[k-1].length; // interFuzz

				if (j < parts.length - 1)
					idxAcc += m[k].length + m[k+1].length;
			}

			info.start[i] = m.index;
		//	info.span[i] = span;

			if (opts.withRanges) {
				let m = mhstr.match(queryR);
				let ranges = info.ranges[i] = [];

				let idxAcc = m.index;
				let from = idxAcc;
				let to = idxAcc;
				for (let i = 1; i < m.length; i++) {
					let len = m[i].length;

					idxAcc += len;

					if (i % 2)
						to = idxAcc;
					else if (len > 0) {
						ranges.push(from, to);
						from = to = idxAcc;
					}
				}

				if (to > from)
					ranges.push(from, to);
			}
		}

		return info;
	};

	return {
		filter,
		info,
		sort: opts.sort,
	};
}

module.exports = uFuzzy;
