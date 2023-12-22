/**
* Copyright (c) 2023, Leon Sorokin
* All rights reserved. (MIT Licensed)
*
* uFuzzy.js (μFuzzy)
* A tiny, efficient fuzzy matcher that doesn't suck
* https://github.com/leeoniya/uFuzzy (v1.0.14)
*/

'use strict';

const cmp = new Intl.Collator('en', { numeric: true, sensitivity: 'base' }).compare;

const inf = Infinity;

// https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Regular_expressions#escaping
const escapeRegExp = str => str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// meh, magic tmp placeholder, must be tolerant to toLocaleLowerCase(), interSplit, and intraSplit
const EXACT_HERE = 'eexxaacctt';

const LATIN_UPPER = 'A-Z';
const LATIN_LOWER = 'a-z';

const swapAlpha = (str, upper, lower) => str.replace(LATIN_UPPER, upper).replace(LATIN_LOWER, lower);

const OPTS = {
	// whether regexps use a /u unicode flag
	unicode: false,

	alpha: null,

	// term segmentation & punct/whitespace merging
	interSplit: "[^A-Za-z\\d']+",
	intraSplit: "[a-z][A-Z]",

	// intra bounds that will be used to increase lft1/rgt1 info counters
	intraBound: "[A-Za-z]\\d|\\d[A-Za-z]|[a-z][A-Z]",

	// inter-bounds mode
	// 2 = strict (will only match 'man' on whitepace and punct boundaries: Mega Man, Mega_Man, mega.man)
	// 1 = loose  (plus allowance for alpha-num and case-change boundaries: MegaMan, 0007man)
	// 0 = any    (will match 'man' as any substring: megamaniac)
	interLft: 0,
	interRgt: 0,

	// allowance between terms
	interChars: '.',
	interIns: inf,

	// allowance between chars in terms
	intraChars: "[a-z\\d']", // internally case-insensitive
	intraIns: null,

	intraContr: "'[a-z]{1,2}\\b",

	// multi-insert or single-error mode
	intraMode: 0,

	// single-error bounds for errors within terms, default requires exact first char
	intraSlice: [1, inf],

	// single-error tolerance toggles
	intraSub: null,
	intraTrn: null,
	intraDel: null,

	// can post-filter matches that are too far apart in distance or length
	// (since intraIns is between each char, it can accum to nonsense matches)
	intraFilt: (term, match, index) => true, // should this also accept WIP info?

	// final sorting fn
	sort: (info, haystack, needle) => {
		let {
			idx,
			chars,
			terms,
			interLft2,
			interLft1,
		//	interRgt2,
		//	interRgt1,
			start,
			intraIns,
			interIns,
		} = info;

		return idx.map((v, i) => i).sort((ia, ib) => (
			// most contig chars matched
			chars[ib] - chars[ia] ||
			// least char intra-fuzz (most contiguous)
			intraIns[ia] - intraIns[ib] ||
			// most prefix bounds, boosted by full term matches
			(
				(terms[ib] + interLft2[ib] + 0.5 * interLft1[ib]) -
				(terms[ia] + interLft2[ia] + 0.5 * interLft1[ia])
			) ||
			// highest density of match (least span)
		//	span[ia] - span[ib] ||
			// highest density of match (least term inter-fuzz)
			interIns[ia] - interIns[ib] ||
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

	let {
		unicode,
		interLft,
		interRgt,
		intraMode,
		intraSlice,
		intraIns,
		intraSub,
		intraTrn,
		intraDel,
		intraContr,
		intraSplit: _intraSplit,
		interSplit: _interSplit,
		intraBound: _intraBound,
		intraChars,
	} = opts;

	intraIns ??= intraMode;
	intraSub ??= intraMode;
	intraTrn ??= intraMode;
	intraDel ??= intraMode;

	let alpha = opts.letters ?? opts.alpha;

	if (alpha != null) {
		let upper = alpha.toLocaleUpperCase();
		let lower = alpha.toLocaleLowerCase();

		_interSplit = swapAlpha(_interSplit, upper, lower);
		_intraSplit = swapAlpha(_intraSplit, upper, lower);
		_intraBound = swapAlpha(_intraBound, upper, lower);
		intraChars = swapAlpha(intraChars, upper, lower);
		intraContr = swapAlpha(intraContr, upper, lower);
	}

	let uFlag = unicode ? 'u' : '';

	const quotedAny = '".+?"';
	const EXACTS_RE = new RegExp(quotedAny, 'gi' + uFlag);
	const NEGS_RE = new RegExp(`(?:\\s+|^)-(?:${intraChars}+|${quotedAny})`, 'gi' + uFlag);

	let { intraRules } = opts;

	if (intraRules == null) {
		intraRules = p => {
			// default is exact term matches only
			let _intraSlice = OPTS.intraSlice, // requires first char
				_intraIns = 0,
				_intraSub = 0,
				_intraTrn = 0,
				_intraDel = 0;

			// only-digits strings should match exactly, else special rules for short strings
			if (/[^\d]/.test(p)) {
				let plen = p.length;

				// prevent junk matches by requiring stricter rules for short terms
				if (plen <= 4) {
					if (plen >= 3) {
						// one swap in non-first char when 3-4 chars
						_intraTrn = Math.min(intraTrn, 1);

						// or one insertion when 4 chars
						if (plen == 4)
							_intraIns = Math.min(intraIns, 1);
					}
					// else exact match when 1-2 chars
				}
				// use supplied opts
				else {
					_intraSlice = intraSlice;
					_intraIns = intraIns,
					_intraSub = intraSub,
					_intraTrn = intraTrn,
					_intraDel = intraDel;
				}
			}

			return {
				intraSlice: _intraSlice,
				intraIns: _intraIns,
				intraSub: _intraSub,
				intraTrn: _intraTrn,
				intraDel: _intraDel,
			};
		};
	}

	let withIntraSplit = !!_intraSplit;

	let intraSplit = new RegExp(_intraSplit, 'g' + uFlag);
	let interSplit = new RegExp(_interSplit, 'g' + uFlag);

	let trimRe = new RegExp('^' + _interSplit + '|' + _interSplit + '$', 'g' + uFlag);
	let contrsRe = new RegExp(intraContr, 'gi' + uFlag);

	const split = needle => {
		let exacts = [];

		needle = needle.replace(EXACTS_RE, m => {
			exacts.push(m);
			return EXACT_HERE;
		});

		needle = needle.replace(trimRe, '').toLocaleLowerCase();

		if (withIntraSplit)
			needle = needle.replace(intraSplit, m => m[0] + ' ' + m[1]);

		let j = 0;
		return needle.split(interSplit).filter(t => t != '').map(v => v === EXACT_HERE ? exacts[j++] : v);
	};

	const NUM_OR_ALPHA_RE = /[^\d]+|\d+/g;

	const prepQuery = (needle, capt = 0, interOR = false) => {
		// split on punct, whitespace, num-alpha, and upper-lower boundaries
		let parts = split(needle);

		if (parts.length == 0)
			return [];

		// split out any detected contractions for each term that become required suffixes
		let contrs = Array(parts.length).fill('');
		parts = parts.map((p, pi) => p.replace(contrsRe, m => {
			contrs[pi] = m;
			return '';
		}));

		// array of regexp tpls for each term
		let reTpl;

		// allows single mutations within each term
		if (intraMode == 1) {
			reTpl = parts.map((p, pi) => {
				if (p[0] === '"')
					return escapeRegExp(p.slice(1, -1));

				let reTpl = '';

				// split into numeric and alpha parts, so numbers are only matched as following punct or alpha boundaries, without swaps or insertions
				for (let m of p.matchAll(NUM_OR_ALPHA_RE)) {
					let p = m[0];

					let {
						intraSlice,
						intraIns,
						intraSub,
						intraTrn,
						intraDel,
					} = intraRules(p);

					if (intraIns + intraSub + intraTrn + intraDel == 0)
						reTpl += p + contrs[pi];
					else {
						let [lftIdx, rgtIdx] = intraSlice;
						let lftChar = p.slice(0, lftIdx); // prefix
						let rgtChar = p.slice(rgtIdx);    // suffix

						let chars = p.slice(lftIdx, rgtIdx);

						// neg lookahead to prefer matching 'Test' instead of 'tTest' in ManifestTest or fittest
						// but skip when search term contains leading repetition (aardvark, aaa)
						if (intraIns == 1 && lftChar.length == 1 && lftChar != chars[0])
							lftChar += '(?!' + lftChar + ')';

						let numChars = chars.length;

						let variants = [p];

						// variants with single char substitutions
						if (intraSub) {
							for (let i = 0; i < numChars; i++)
								variants.push(lftChar + chars.slice(0, i) + intraChars + chars.slice(i + 1) + rgtChar);
						}

						// variants with single transpositions
						if (intraTrn) {
							for (let i = 0; i < numChars - 1; i++) {
								if (chars[i] != chars[i+1])
									variants.push(lftChar + chars.slice(0, i) + chars[i+1] + chars[i] + chars.slice(i + 2) + rgtChar);
							}
						}

						// variants with single char omissions
						if (intraDel) {
							for (let i = 0; i < numChars; i++)
								variants.push(lftChar + chars.slice(0, i + 1) + '?' + chars.slice(i + 1) + rgtChar);
						}

						// variants with single char insertions
						if (intraIns) {
							let intraInsTpl = lazyRepeat(intraChars, 1);

							for (let i = 0; i < numChars; i++)
								variants.push(lftChar + chars.slice(0, i) + intraInsTpl + chars.slice(i) + rgtChar);
						}

						reTpl += '(?:' + variants.join('|') + ')' + contrs[pi];
					}
				}

			//	console.log(reTpl);

				return reTpl;
			});
		}
		else {
			let intraInsTpl = lazyRepeat(intraChars, intraIns);

			// capture at char level
			if (capt == 2 && intraIns > 0) {
				// sadly, we also have to capture the inter-term junk via parenth-wrapping .*?
				// to accum other capture groups' indices for \b boosting during scoring
				intraInsTpl = ')(' + intraInsTpl + ')(';
			}

			reTpl = parts.map((p, pi) => p[0] === '"' ? escapeRegExp(p.slice(1, -1)) :  p.split('').map((c, i, chars) => {
				// neg lookahead to prefer matching 'Test' instead of 'tTest' in ManifestTest or fittest
				// but skip when search term contains leading repetition (aardvark, aaa)
				if (intraIns == 1 && i == 0 && chars.length > 1 && c != chars[i+1])
					c += '(?!' + c + ')';

				return c;
			}).join(intraInsTpl) + contrs[pi]);
		}

	//	console.log(reTpl);

		// this only helps to reduce initial matches early when they can be detected
		// TODO: might want a mode 3 that excludes _
		let preTpl = interLft == 2 ? mode2Tpl : '';
		let sufTpl = interRgt == 2 ? mode2Tpl : '';

		let interCharsTpl = sufTpl + lazyRepeat(opts.interChars, opts.interIns) + preTpl;

		// capture at word level
		if (capt > 0) {
			if (interOR) {
				// this is basically for doing .matchAll() occurence counting and highlighting without needing permuted ooo needles
				reTpl = preTpl + '(' + reTpl.join(')' + sufTpl + '|' + preTpl + '(') + ')' + sufTpl;
			}
			else {
				// sadly, we also have to capture the inter-term junk via parenth-wrapping .*?
				// to accum other capture groups' indices for \b boosting during scoring
				reTpl = '(' + reTpl.join(')(' + interCharsTpl + ')(') + ')';
				reTpl = '(.??' + preTpl + ')' + reTpl + '(' + sufTpl + '.*)'; // nit: trailing capture here assumes interIns = Inf
			}
		}
		else {
			reTpl = reTpl.join(interCharsTpl);
			reTpl = preTpl + reTpl + sufTpl;
		}

	//	console.log(reTpl);

		return [new RegExp(reTpl, 'i' + uFlag), parts, contrs];
	};

	const filter = (haystack, needle, idxs) => {

		let [query] = prepQuery(needle);

		if (query == null)
			return null;

		let out = [];

		if (idxs != null) {
			for (let i = 0; i < idxs.length; i++) {
				let idx = idxs[i];
				query.test(haystack[idx]) && out.push(idx);
			}
		}
		else {
			for (let i = 0; i < haystack.length; i++)
				query.test(haystack[i]) && out.push(i);
		}

		return out;
	};

	let withIntraBound = !!_intraBound;

	let interBound = new RegExp(_interSplit, uFlag);
	let intraBound = new RegExp(_intraBound, uFlag);

	const info = (idxs, haystack, needle) => {

		let [query, parts, contrs] = prepQuery(needle, 1);
		let [queryR] = prepQuery(needle, 2);
		let partsLen = parts.length;

		let len = idxs.length;

		let field = Array(len).fill(0);

		let info = {
			// idx in haystack
			idx: Array(len),

			// start of match
			start: field.slice(),
			// length of match
		//	span: field.slice(),

			// contiguous chars matched
			chars: field.slice(),

			// contiguous (no fuzz) and bounded terms (intra=0, lft2/1, rgt2/1)
			// excludes terms that are contiguous but have < 2 bounds (substrings)
			terms: field.slice(),

			// cumulative length of unmatched chars (fuzz) within span
			interIns: field.slice(), // between terms
			intraIns: field.slice(), // within terms

			// interLft/interRgt counters
			interLft2: field.slice(),
			interRgt2: field.slice(),
			interLft1: field.slice(),
			interRgt1: field.slice(),

			ranges: Array(len),
		};

		// might discard idxs based on bounds checks
		let mayDiscard = interLft == 1 || interRgt == 1;

		let ii = 0;

		for (let i = 0; i < idxs.length; i++) {
			let mhstr = haystack[idxs[i]];

			// the matched parts are [full, junk, term, junk, term, junk]
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
			let chars = 0;
			let terms = 0;
			let inter = 0;
			let intra = 0;

			let refine = [];

			for (let j = 0, k = 2; j < partsLen; j++, k+=2) {
				let group = m[k].toLocaleLowerCase();
				let part = parts[j];
				let term = part[0] == '"' ? part.slice(1, -1) : part + contrs[j];
				let termLen = term.length;
				let groupLen = group.length;
				let fullMatch = group == term;

				// this won't handle the case when an exact match exists across the boundary of the current group and the next junk
				// e.g. blob,ob when searching for 'bob' but finding the earlier `blob` (with extra insertion)
				if (!fullMatch && m[k+1].length >= termLen) {
					// probe for exact match in inter junk (TODO: maybe even in this matched part?)
					let idxOf = m[k+1].toLocaleLowerCase().indexOf(term);

					if (idxOf > -1) {
						refine.push(idxAcc, groupLen, idxOf, termLen);
						idxAcc += refineMatch(m, k, idxOf, termLen);
						group = term;
						groupLen = termLen;
						fullMatch = true;

						if (j == 0)
							start = idxAcc;
					}
				}

				if (mayDiscard || fullMatch) {
					// does group's left and/or right land on \b
					let lftCharIdx = idxAcc - 1;
					let rgtCharIdx = idxAcc + groupLen;

					let isPre = false;
					let isSuf = false;

					// prefix info
					if (lftCharIdx == -1           || interBound.test(mhstr[lftCharIdx])) {
						fullMatch && lft2++;
						isPre = true;
					}
					else {
						if (interLft == 2) {
							disc = true;
							break;
						}

						if (withIntraBound && intraBound.test(mhstr[lftCharIdx] + mhstr[lftCharIdx + 1])) {
							fullMatch && lft1++;
							isPre = true;
						}
						else {
							if (interLft == 1) {
								// regexps are eager, so try to improve the match by probing forward inter junk for exact match at a boundary
								let junk = m[k+1];
								let junkIdx = idxAcc + groupLen;

								if (junk.length >= termLen) {
									let idxOf = 0;
									let found = false;
									let re = new RegExp(term, 'ig' + uFlag);

									let m2;
									while (m2 = re.exec(junk)) {
										idxOf = m2.index;

										let charIdx = junkIdx + idxOf;
										let lftCharIdx = charIdx - 1;

										if (lftCharIdx == -1 || interBound.test(mhstr[lftCharIdx])) {
											lft2++;
											found = true;
											break;
										}
										else if (intraBound.test(mhstr[lftCharIdx] + mhstr[charIdx])) {
											lft1++;
											found = true;
											break;
										}
									}

									if (found) {
										isPre = true;

										// identical to exact term refinement pass above
										refine.push(idxAcc, groupLen, idxOf, termLen);
										idxAcc += refineMatch(m, k, idxOf, termLen);
										group = term;
										groupLen = termLen;
										fullMatch = true;

										if (j == 0)
											start = idxAcc;
									}
								}

								if (!isPre) {
									disc = true;
									break;
								}
							}
						}
					}

					// suffix info
					if (rgtCharIdx == mhstr.length || interBound.test(mhstr[rgtCharIdx])) {
						fullMatch && rgt2++;
						isSuf = true;
					}
					else {
						if (interRgt == 2) {
							disc = true;
							break;
						}

						if (withIntraBound && intraBound.test(mhstr[rgtCharIdx - 1] + mhstr[rgtCharIdx])) {
							fullMatch && rgt1++;
							isSuf = true;
						}
						else {
							if (interRgt == 1) {
								disc = true;
								break;
							}
						}
					}

					if (fullMatch) {
						chars += termLen;

						if (isPre && isSuf)
							terms++;
					}
				}

				if (groupLen > termLen)
					intra += groupLen - termLen; // intraFuzz

				if (j > 0)
					inter += m[k-1].length; // interFuzz

				// TODO: group here is lowercased, which is okay for length cmp, but not more case-sensitive filts
				if (!opts.intraFilt(term, group, idxAcc)) {
					disc = true;
					break;
				}

				if (j < partsLen - 1)
					idxAcc += groupLen + m[k+1].length;
			}

			if (!disc) {
				info.idx[ii]       = idxs[i];
				info.interLft2[ii] = lft2;
				info.interLft1[ii] = lft1;
				info.interRgt2[ii] = rgt2;
				info.interRgt1[ii] = rgt1;
				info.chars[ii]     = chars;
				info.terms[ii]     = terms;
				info.interIns[ii]  = inter;
				info.intraIns[ii]  = intra;

				info.start[ii] = start;
			//	info.span[ii] = span;

				// ranges
				let m = mhstr.match(queryR);

				let idxAcc = m.index + m[1].length;

				let refLen = refine.length;
				let ri = refLen > 0 ? 0 : Infinity;
				let lastRi = refLen - 4;

				for (let i = 2; i < m.length;) {
					let len = m[i].length;

					if (ri <= lastRi && refine[ri] == idxAcc) {
						let groupLen = refine[ri+1];
						let idxOf    = refine[ri+2];
						let termLen  = refine[ri+3];

						// advance to end of original (full) group match that includes intra-junk
						let j = i;
						let v = '';
						for (let _len = 0; _len < groupLen; j++) {
							v += m[j];
							_len += m[j].length;
						}

						m.splice(i, j - i, v);

						idxAcc += refineMatch(m, i, idxOf, termLen);

						ri += 4;
					}
					else {
						idxAcc += len;
						i++;
					}
				}

				idxAcc = m.index + m[1].length;

				let ranges = info.ranges[ii] = [];
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

	const refineMatch = (m, k, idxInNext, termLen) => {
		// shift the current group into the prior junk
		let prepend = m[k] + m[k+1].slice(0, idxInNext);
		m[k-1] += prepend;
		m[k]    = m[k+1].slice(idxInNext, idxInNext + termLen);
		m[k+1]  = m[k+1].slice(idxInNext + termLen);
		return prepend.length;
	};

	const OOO_TERMS_LIMIT = 5;

	// returns [idxs, info, order]
	const _search = (haystack, needle, outOfOrder, infoThresh = 1e3, preFiltered) => {
		outOfOrder = !outOfOrder ? 0 : outOfOrder === true ? OOO_TERMS_LIMIT : outOfOrder;

		let needles = null;
		let matches = null;

		let negs = [];

		needle = needle.replace(NEGS_RE, m => {
			let neg = m.trim().slice(1);

			if (neg[0] === '"')
				neg = escapeRegExp(neg.slice(1,-1));

			negs.push(neg);
			return '';
		});

		let terms = split(needle);

		let negsRe;

		if (negs.length > 0) {
			negsRe = new RegExp(negs.join('|'), 'i' + uFlag);

			if (terms.length == 0) {
				let idxs = [];

				for (let i = 0; i < haystack.length; i++) {
					if (!negsRe.test(haystack[i]))
						idxs.push(i);
				}

				return [idxs, null, null];
			}
		}
		else {
			// abort search (needle is empty after pre-processing, e.g. no alpha-numeric chars)
			if (terms.length == 0)
				return [null, null, null];
		}

	//	console.log(negs);
	//	console.log(needle);

		if (outOfOrder > 0) {
			// since uFuzzy is an AND-based search, we can iteratively pre-reduce the haystack by searching
			// for each term in isolation before running permutations on what's left.
			// this is a major perf win. e.g. searching "test man ger pp a" goes from 570ms -> 14ms
			let terms = split(needle);

			if (terms.length > 1) {
				// longest -> shortest
				let terms2 = terms.slice().sort((a, b) => b.length - a.length);

				for (let ti = 0; ti < terms2.length; ti++) {
					// no haystack item contained all terms
					if (preFiltered?.length == 0)
						return [[], null, null];

					preFiltered = filter(haystack, terms2[ti], preFiltered);
				}

				// avoid combinatorial explosion by limiting outOfOrder to 5 terms (120 max searches)
				// fall back to just filter() otherwise
				if (terms.length > outOfOrder)
					return [preFiltered, null, null];

				needles = permute(terms).map(perm => perm.join(' '));

				// filtered matches for each needle excluding same matches for prior needles
				matches = [];

				// keeps track of already-matched idxs to skip in follow-up permutations
				let matchedIdxs = new Set();

				for (let ni = 0; ni < needles.length; ni++) {
					if (matchedIdxs.size < preFiltered.length) {
						// filter further for this needle, exclude already-matched
						let preFiltered2 = preFiltered.filter(idx => !matchedIdxs.has(idx));

						let matched = filter(haystack, needles[ni], preFiltered2);

						for (let j = 0; j < matched.length; j++)
							matchedIdxs.add(matched[j]);

						matches.push(matched);
					}
					else
						matches.push([]);
				}
			}
		}

		// interOR
	//	console.log(prepQuery(needle, 1, null, true));

		// non-ooo or ooo w/single term
		if (needles == null) {
			needles = [needle];
			matches = [preFiltered?.length > 0 ? preFiltered : filter(haystack, needle)];
		}

		let retInfo = null;
		let retOrder = null;

		if (negs.length > 0)
			matches = matches.map(idxs => idxs.filter(idx => !negsRe.test(haystack[idx])));

		let matchCount = matches.reduce((acc, idxs) => acc + idxs.length, 0);

		// rank, sort, concat
		if (matchCount <= infoThresh) {
			retInfo = {};
			retOrder = [];

			for (let ni = 0; ni < matches.length; ni++) {
				let idxs = matches[ni];

				if (idxs == null || idxs.length == 0)
					continue;

				let needle = needles[ni];
				let _info = info(idxs, haystack, needle);
				let order = opts.sort(_info, haystack, needle);

				// offset idxs for concat'ing infos
				if (ni > 0) {
					for (let i = 0; i < order.length; i++)
						order[i] += retOrder.length;
				}

				for (let k in _info)
					retInfo[k] = (retInfo[k] ?? []).concat(_info[k]);

				retOrder = retOrder.concat(order);
			}
		}

		return [
			[].concat(...matches),
			retInfo,
			retOrder,
		];
	};

	return {
		search: (...args) => {
			let out = _search(...args);
			return out;
		},
		split,
		filter,
		info,
		sort: opts.sort,
	};
}

const latinize = (() => {
	let accents = {
		A: 'ÁÀÃÂÄĄ',
		a: 'áàãâäą',
		E: 'ÉÈÊËĖ',
		e: 'éèêëę',
		I: 'ÍÌÎÏĮ',
		i: 'íìîïį',
		O: 'ÓÒÔÕÖ',
		o: 'óòôõö',
		U: 'ÚÙÛÜŪŲ',
		u: 'úùûüūų',
		C: 'ÇČĆ',
		c: 'çčć',
		L: 'Ł',
		l: 'ł',
		N: 'ÑŃ',
		n: 'ñń',
		S: 'ŠŚ',
		s: 'šś',
		Z: 'ŻŹ',
		z: 'żź'
	};

	let accentsMap = new Map();
	let accentsTpl = '';

	for (let r in accents) {
		accents[r].split('').forEach(a => {
			accentsTpl += a;
			accentsMap.set(a, r);
		});
	}

	let accentsRe = new RegExp(`[${accentsTpl}]`, 'g');
	let replacer = m => accentsMap.get(m);

	return strings => {
		if (typeof strings == 'string')
			return strings.replace(accentsRe, replacer);

		let out = Array(strings.length);
		for (let i = 0; i < strings.length; i++)
			out[i] = strings[i].replace(accentsRe, replacer);
		return out;
	};
})();

// https://stackoverflow.com/questions/9960908/permutations-in-javascript/37580979#37580979
function permute(arr) {
	arr = arr.slice();

	let length = arr.length,
		result = [arr.slice()],
		c = new Array(length).fill(0),
		i = 1, k, p;

	while (i < length) {
		if (c[i] < i) {
			k = i % 2 && c[i];
			p = arr[i];
			arr[i] = arr[k];
			arr[k] = p;
			++c[i];
			i = 1;
			result.push(arr.slice());
		} else {
			c[i] = 0;
			++i;
		}
	}

	return result;
}

const _mark = (part, matched) => matched ? `<mark>${part}</mark>` : part;
const _append = (acc, part) => acc + part;

function highlight(str, ranges, mark = _mark, accum = '', append = _append) {
	accum = append(accum, mark(str.substring(0, ranges[0]), false)) ?? accum;

	for (let i = 0; i < ranges.length; i+=2) {
		let fr = ranges[i];
		let to = ranges[i+1];

		accum = append(accum, mark(str.substring(fr, to), true)) ?? accum;

		if (i < ranges.length - 3)
			accum = append(accum, mark(str.substring(ranges[i+1], ranges[i+2]), false)) ?? accum;
	}

	accum = append(accum, mark(str.substring(ranges[ranges.length - 1]), false)) ?? accum;

	return accum;
}

uFuzzy.latinize = latinize;
uFuzzy.permute = arr => {
	let idxs = permute([...Array(arr.length).keys()]).sort((a,b) => {
		for (let i = 0; i < a.length; i++) {
			if (a[i] != b[i])
				return a[i] - b[i];
		}
		return 0;
	});

	return idxs.map(pi => pi.map(i => arr[i]));
};
uFuzzy.highlight = highlight;

module.exports = uFuzzy;
