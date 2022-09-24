/**
* Copyright (c) 2022, Leon Sorokin
* All rights reserved. (MIT Licensed)
*
* uFuzzy.js (μFuzzy)
* A fuzzy matcher that doesn't suck
* https://github.com/leeoniya/uFuzzy (v0.0.1)
*/

const cmp = new Intl.Collator('en').compare;

const inf = Infinity;

const OPTS = {
	// term segmentation & punct/whitespace merging
	interSplit: '[^A-Za-z0-9]+',
	intraSplit: '[A-Za-z][0-9]|[0-9][A-Za-z]|[a-z][A-Z]',

	// inter-bounds mode
	// 2 = strict (will only match 'man' on whitepace and punct boundaries: Mega Man, Mega_Man, mega.man)
	// 1 = loose  (plus allowance for alpha-num and case-change boundaries: MegaMan, 0007man)
	// 0 = none   (will match 'man' as any substring: megamaniac)
	lftMode: 0,
	rgtMode: 0,

	// allowance between terms
	interChars: '.',
	interMax: inf,

	// allowance between chars in terms
	intraChars: '[a-z\\d]', // internally case-insensitive
	intraMax: 0,

	// can post-filter matches that are too far apart in distance or length
	// (since intraMax is between each char, it can accum to nonsense matches)
	intraFilt: (term, match, index) => true, // should this also accept WIP info?

	// final sorting fn
	sort: (info, haystack, needle) => {
		let { idx, term, lft2, lft1, rgt2, rgt1, span, start, intra, inter } = info;

		return idx.map((v, i) => i).sort((ia, ib) => (
			// least char intra-fuzz (most contiguous)
			intra[ia] - intra[ib] ||
			// most prefix/suffix bounds, boosted by full term matches
			(
				(term[ib] + lft2[ib] + 0.5 * lft1[ib] + rgt2[ib] + 0.5 * rgt1[ib]) -
				(term[ia] + lft2[ia] + 0.5 * lft1[ia] + rgt2[ia] + 0.5 * rgt1[ia])
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

const mode2Tpl = '(?:\\b|_)';

function uFuzzy(opts) {
	opts = Object.assign({}, OPTS, opts);

	let intraSplit = new RegExp(opts.intraSplit, 'g');
	let interSplit = new RegExp(opts.interSplit, 'g');

	const { lftMode, rgtMode } = opts;

	const prepQuery = (query, capt = 0) => {
		// split on punct, whitespace, num-alpha, and upper-lower boundaries
		let parts = query.trim().replace(intraSplit, m => m[0] + ' ' + m[1]).split(interSplit);

		let intraCharsTpl = lazyRepeat(opts.intraChars, opts.intraMax);

		// capture at char level
		if (capt == 2 && opts.intraMax > 0) {
			// sadly, we also have to capture the inter-term junk via parenth-wrapping .*?
			// to accum other capture groups' indices for \b boosting during scoring
			intraCharsTpl = ')(' + intraCharsTpl + ')(';
		}

		// array of regexp tpls for each term
		let reTpl = parts.map(p => p.split('').join(intraCharsTpl));

		// this only helps to reduce initial matches early when they can be detected
		// TODO: might want a mode 3 that excludes _
		let preTpl = lftMode == 2 ? mode2Tpl : '';
		let sufTpl = rgtMode == 2 ? mode2Tpl : '';

		let interCharsTpl = sufTpl + lazyRepeat(opts.interChars, opts.interMax) + preTpl;

		// capture at word level
		if (capt > 0) {
			// sadly, we also have to capture the inter-term junk via parenth-wrapping .*?
			// to accum other capture groups' indices for \b boosting during scoring
			reTpl = '(' + reTpl.join(')(' + interCharsTpl + ')(') + ')';
		}
		else
			reTpl = reTpl.join(interCharsTpl);

		if (capt > 0) {
			if (lftMode == 2)
				reTpl = '(' + preTpl + ')' + reTpl + '(' + sufTpl + ')';
			else
				reTpl = '(.?)' + reTpl + '(.?)';
		}
		else
			reTpl = preTpl + reTpl + sufTpl;

	//	console.log(reTpl);

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
		let [queryR] = prepQuery(needle, 2);

		let len = idxs.length;

		let field = Array(len).fill(0);

		let info = {
			// idx in haystack
			idx: Array(len),

			// start of match
			start: field.slice(),
			// length of match
		//	span: field.slice(),

			// contiguous (no fuzz) and bounded terms (intra=0, lft2/1, rgt2/1)
			// excludes terms that are contiguous but have < 2 bounds (substrings)
			term: field.slice(),
			// contiguous chars matched (currently, from full terms)
		//	chars: field.slice(),

			// cumulative length of unmatched chars (fuzz) within span
			inter: field.slice(), // between terms
			intra: field.slice(), // between chars within terms

			// hard/soft prefix/suffix counts
			// e.g. MegaMan (lft2: 1, rgt2: 1, lft1: 1, rgt1: 1), Mega Man (lft2: 2, rgt2: 2)
			// hard boundaries
			lft2: field.slice(),
			rgt2: field.slice(),
			// soft boundaries
			lft1: field.slice(),
			rgt1: field.slice(),

			ranges: Array(len),
		};

		// might discard idxs based on bounds checks
		let mayDiscard = lftMode == 1 || rgtMode == 1;

		let ii = 0;

		for (let i = 0; i < idxs.length; i++) {
			let mhstr = haystack[idxs[i]];
			let m = mhstr.match(query);

			// leading junk
			let start = m.index + m[1].length;

			let idxAcc = start;
		//	let span = m[0].length;

			let disc = false;
			let lft2 = 0;
			let lft1 = 0;
			let rgt2 = 0;
			let rgt1 = 0;
			let term = 0;
			let inter = 0;
			let intra = 0;

			for (let j = 0, k = 2; j < parts.length; j++, k+=2) {
				let group = m[k].toLowerCase();
				let fullMatch = group == parts[j];

				if (!fullMatch) {
					// when intraMax > 0 'test' query can match 'ttest' in 'fittest'
					// try an exact substring match to improve rank quality
					if (opts.intraMax > 0) {
						let idxOf = group.indexOf(parts[j]);
						if (idxOf > -1) {
							fullMatch = true;
							idxAcc += idxOf;
							m[k] = m[k].slice(idxOf);

							if (j == 0) {
								start = idxAcc;
							//	span -= idxOf;
							}
						}
					}

					// TODO: use difference in group/part length to boost eSyms? or iSyms (inexact)
				}

				if (mayDiscard || fullMatch) {
					// does group's left and/or right land on \b
					let lftCharIdx = idxAcc - 1;
					let rgtCharIdx = idxAcc + m[k].length;

					let isPre = true;
					let isSuf = true;

					// prefix info
					if (lftCharIdx == -1           || interBound.test(mhstr[lftCharIdx]))
						fullMatch && lft2++;
					else {
						if (lftMode == 2) {
							disc = true;
							break;
						}

						if (intraBound.test(mhstr[lftCharIdx] + mhstr[lftCharIdx + 1]))
							fullMatch && lft1++;
						else {
							if (lftMode == 1) {
								disc = true;
								break;
							}

							isPre = false;
						}
					}

					// suffix info
					if (rgtCharIdx == mhstr.length || interBound.test(mhstr[rgtCharIdx]))
						fullMatch && rgt2++;
					else {
						if (rgtMode == 2) {
							disc = true;
							break;
						}

						if (intraBound.test(mhstr[rgtCharIdx - 1] + mhstr[rgtCharIdx]))
							fullMatch && rgt1++;
						else {
							if (rgtMode == 1) {
								disc = true;
								break;
							}

							isSuf = false;
						}
					}

					if (fullMatch && isPre && isSuf)
						term++;
				}
				else
					intra += group.length - parts[j].length; // intraFuzz

				if (j > 0)
					inter += m[k-1].length; // interFuzz

				if (!opts.intraFilt(parts[j], group, idxAcc)) {
					disc = true;
					break;
				}

				if (j < parts.length - 1)
					idxAcc += m[k].length + m[k+1].length;
			}

			if (!disc) {
				info.idx[ii]  = idxs[i];
				info.lft2[ii] = lft2;
				info.lft1[ii] = lft1;
				info.rgt2[ii] = rgt2;
				info.rgt1[ii] = rgt1;
				info.term[ii] = term;
				info.inter[ii] = inter;
				info.intra[ii] = intra;

				info.start[ii] = start;
			//	info.span[ii] = span;

				// ranges
				let m = mhstr.match(queryR);
				let ranges = info.ranges[ii] = [];

				let idxAcc = m.index + m[1].length;
				let from = idxAcc;
				let to = idxAcc;
				for (let i = 2; i < m.length; i++) {
					let len = m[i].length;

					idxAcc += len;

					if (i % 2 == 0)
						to = idxAcc;
					else if (len > 0) {
						ranges.push(from, to);
						from = to = idxAcc;
					}
				}

				if (to > from)
					ranges.push(from, to);

				ii++;
			}
		}

		// trim arrays
		if (ii < idxs.length) {
			for (let k in info)
				info[k] = info[k].slice(0, ii);
		}

		return info;
	};

	return {
		filter,
		info,
		sort: opts.sort,
	};
}

export { uFuzzy as default };
