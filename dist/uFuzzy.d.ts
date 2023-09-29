declare class uFuzzy {
	constructor(opts?: uFuzzy.Options);

	/** search API composed of filter/info/sort, with a info/ranking threshold (1e3) and fast outOfOrder impl */
	search(
		haystack: string[],
		needle: string,
		/** limit how many terms will be permuted, default = 0; 5 will result in up to 5! (120) search iterations. be careful with this! */
		outOfOrder?: number,
		/** default = 1e3 */
		infoThresh?: number,
		preFiltered?: uFuzzy.HaystackIdxs | null
	): uFuzzy.SearchResult;

	/** initial haystack filter, can accept idxs from previous prefix/typeahead match as optimization */
	filter(
		haystack: string[],
		needle: string,
		idxs?: uFuzzy.HaystackIdxs
	): uFuzzy.HaystackIdxs | null;

	/** collects stats about pre-filtered matches, does additional filtering based on term boundary settings, finds highlight ranges */
	info(
		idxs: uFuzzy.HaystackIdxs,
		haystack: string[],
		needle: string
	): uFuzzy.Info;

	/** performs final result sorting via Array.sort(), relying on Info */
	sort(
		info: uFuzzy.Info,
		haystack: string[],
		needle: string
	): uFuzzy.InfoIdxOrder;

	/** utility for splitting needle into terms following defined interSplit/intraSplit opts. useful for out-of-order permutes */
	split(needle: string): uFuzzy.Terms;

	/** util for creating out-of-order permutations of a needle terms array */
	static permute(arr: unknown[]): unknown[][];

	/** util for replacing common diacritics/accents */
	static latinize<T extends string[] | string>(strings: T): T;

	/** util for highlighting matched substr parts of a result */
	static highlight<TAccum = string, TMarkedPart = string>(
		match: string,
		ranges: number[],

		mark?: (part: string, matched: boolean) => TMarkedPart,
		accum?: TAccum,
		append?: (accum: TAccum, part: TMarkedPart) => TAccum | undefined
	): TAccum;
}

export = uFuzzy;

declare namespace uFuzzy {
	/** needle's terms */
	export type Terms = string[];

	/** subset of idxs of a haystack array */
	export type HaystackIdxs = number[];

	/** sorted order in which info facets should be iterated */
	export type InfoIdxOrder = number[];

	export type AbortedResult = [null, null, null];

	export type FilteredResult = [uFuzzy.HaystackIdxs, null, null];

	export type RankedResult = [
		uFuzzy.HaystackIdxs,
		uFuzzy.Info,
		uFuzzy.InfoIdxOrder
	];

	export type SearchResult = FilteredResult | RankedResult | AbortedResult;

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

	export const enum IntraMode {
		/** allows any number of extra char insertions within a term, but all term chars must be present for a match */
		MultiInsert = 0,
		/** allows for a single-char substitution, transposition, insertion, or deletion within terms (excluding first and last chars) */
		SingleError = 1,
	}

	export type IntraSliceIdxs = [from: number, to: number];

	export interface Options {
		// whether regexps use a /u unicode flag
		unicode?: boolean; // false

		/** @deprecated renamed to opts.alpha */
		letters?: PartialRegExp | null;     // a-z

		// regexp character class [] of chars which should be treated as letters (case insensitive)
		alpha?: PartialRegExp | null;       // a-z

		/** term segmentation & punct/whitespace merging */
		interSplit?: PartialRegExp;         // '[^A-Za-z0-9]+'
		intraSplit?: PartialRegExp | null;  // '[a-z][A-Z]'

		/** intra bounds that will be used to increase lft1/rgt1 info counters */
		intraBound?: PartialRegExp | null;  // '[A-Za-z][0-9]|[0-9][A-Za-z]|[a-z][A-Z]'

		/** inter-term modes, during .info() can discard matches when bounds conditions are not met */
		interLft?: BoundMode;        // 0
		interRgt?: BoundMode;        // 0

		/** allowance between terms */
		interChars?: PartialRegExp;  // '.'
		interIns?: number;           // Infinity

		/** allowance between chars within terms */
		intraChars?: PartialRegExp;  // '[a-z\\d]'
		intraIns?: number;           // 0

		/** contractions detection */
		intraContr?: PartialRegExp;  // "'[a-z]{1,2}\\b"

		/** error tolerance mode within terms. will clamp intraIns to 1 when set to SingleError */
		intraMode?: IntraMode;       // 0

		/** which part of each term should tolerate errors (when intraMode: 1) */
		intraSlice?: IntraSliceIdxs; // [1, Infinity]

		/** max substitutions (when intraMode: 1) */
		intraSub?: 0 | 1; // 0
		/** max transpositions (when intraMode: 1) */
		intraTrn?: 0 | 1; // 0
		/** max omissions/deletions (when intraMode: 1) */
		intraDel?: 0 | 1; // 0

		/** can dynamically adjust error tolerance rules per term in needle (when intraMode: 1) */
		intraRules?: (term: string) => {
			intraSlice?: IntraSliceIdxs;
			intraIns: 0 | 1;
			intraSub: 0 | 1;
			intraTrn: 0 | 1;
			intraDel: 0 | 1;
		};

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
		interLft2: number[];
		/** number of right BoundMode.Strict term boundaries found */
		interRgt2: number[];
		/** number of left BoundMode.Loose term boundaries found */
		interLft1: number[];
		/** number of right BoundMode.Loose term boundaries found */
		interRgt1: number[];

		/** total number of extra chars matched within all terms. higher = matched terms have more fuzz in them */
		intraIns: number[];
		/** total number of chars found in between matched terms. higher = terms are more sparse, have more fuzz in between them */
		interIns: number[];

		/** total number of matched contiguous chars (substrs but not necessarily full terms) */
		chars: number[];

		/** number of exactly-matched terms (intra = 0) where both lft and rgt landed on a BoundMode.Loose or BoundMode.Strict boundary */
		terms: number[];

		/** offset ranges within match for highlighting: [startIdx0, endIdx0, startIdx1, endIdx1,...] */
		ranges: number[][];
	}
}

export as namespace uFuzzy;
