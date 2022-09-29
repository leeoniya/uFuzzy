declare class uFuzzy {
	constructor(opts?: uFuzzy.Options);

	/** initial haystack filter, can accept idxs from previous prefix/typeahead match as optimization */
	filter(haystack: string[], needle: string, idxs?: uFuzzy.HaystackIdxs): uFuzzy.HaystackIdxs;

	/** collects stats about pre-filtered matches, does additional filtering based on term boundary settings, finds highlight ranges */
	info(idxs: uFuzzy.HaystackIdxs, haystack: string[], needle: string): uFuzzy.Info;

	/** performs final result sorting via Array.sort(), relying on Info */
	sort(info: uFuzzy.Info, haystack: string[], needle: string): uFuzzy.InfoIdxOrder;

	/** utility for splitting needle into terms following defined interSplit/intraSplit opts. useful for out-of-order permutes */
	split(needle: string): uFuzzy.Terms;

	/** util for creating out-of-order permutations of a needle terms array */
	static permute(arr: unknown[]): unknown[][];

	/** util for replacing common diacritics/accents */
	static latinize(strings: string[]): string[];
}

export = uFuzzy;

declare namespace uFuzzy {
	/** needle's terms */
	export type Terms = string[];

	/** subset of idxs of a haystack array */
	export type HaystackIdxs = number[];

	/** sorted order in which info facets should be iterated */
	export type InfoIdxOrder = number[];

	/** partial RegExp */
	type PartialRegExp = string;

	/** what should be considered acceptable term bounds */
	export const enum BoundMode {
		/** will match 'man' substr anywhere. e.g. tasmania */
		Any = 0,
		/** will match 'man' at whitespace, punct, case-change, and alpha-num boundaries. e.g. mantis, SuperMan, fooManBar, 0007man */
		Loose = 1,
		/** will match 'man' at whitespace, punct boundaries only. e.g. mega man, walk_man, man-made, foo.man.bar */
		Strict = 2,
	}

	export interface Options {
		/** term segmentation & punct/whitespace merging */
		interSplit?: PartialRegExp;  // '[^A-Za-z0-9]+'
		intraSplit?: PartialRegExp;  // '[A-Za-z][0-9]|[0-9][A-Za-z]|[a-z][A-Z]'

		/** inter-term modes, during .info() can discard matches when bounds conditions are not met */
		interLft?: BoundMode;        // 0
		interRgt?: BoundMode;        // 0

		/** allowance between terms */
		interChars?: PartialRegExp;  // '.'
		interMax?: number;           // Infinity

		/** allowance between chars within terms */
		intraChars?: PartialRegExp;  // '[a-z\\d]'
		intraMax?: number;           // 0

		/** post-filters matches during .info() based on cmp of term in needle vs partial match */
		intraFilt?: (term: string, match: string, index: number) => boolean; // should this also accept WIP info?

		sort?: (info: Info, haystack: string[], needle: string) => InfoIdxOrder;
	}

	export interface Info {
		/** matched idxs from haystack */
		idx: HaystackIdxs;

		/** match offsets */
		start: number[];

		/** number of left BoundMode.Strict term boundaries found */
		lft2: number[];
		/** number of right BoundMode.Strict term boundaries found */
		rgt2: number[];
		/** number of left BoundMode.Loose term boundaries found */
		lft1: number[];
		/** number of right BoundMode.Loose term boundaries found */
		rgt1: number[];

		/** total number of extra chars matched within all terms. higher = matched terms have more fuzz in them */
		intra: number[];
		/** total number of chars found in between matched terms. higher = terms are more sparse, have more fuzz in between them */
		inter: number[];

		/** number of exactly-matched terms (intra = 0) where both lft and rgt landed on a BoundMode.Loose or BoundMode.Strict boundary */
		terms: number[];

		/** offset ranges within match for highlighting: [startIdx0, endIdx0, startIdx1, endIdx1,...] */
		ranges: number[][];
	}
}

export as namespace uFuzzy;