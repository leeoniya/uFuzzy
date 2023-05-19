var fuzzbunny = (function (exports) {
    'use strict';

    const SCORE_START_STR = 1000;
    const SCORE_PREFIX = 200;
    const SCORE_CONTIGUOUS = 300;

    /**
     * @param {number} idx - index of the match
     * @param {number} len - length of the match
     * @param {boolean} isPrefix - was it a prefix of a word
     * @returns {number} - score of the match, higher is better
     */
    function _getMatchScore(idx, len, isPrefix) {
      let score = 0;

      // increase score exponentially per letter matched so that contiguous matches are ranked higher
      // i.e '[abc]' ranks higher than '[ab]ott [c]hemicals'
      score += SCORE_CONTIGUOUS * len * len;

      if (idx === 0) {
        // matching at the start of string gets a ranking bonus
        score += SCORE_START_STR;
      } else if (isPrefix) {
        // closer to the start, the higher it ranks
        score += SCORE_PREFIX - idx;
      }

      return score;
    }

    // Ascii codes: <w_space>!"#$%&'()*+,-./0123456789:;<=>?@
    // ABCDEFGHIJKLMNOPQRSTUVWXYZ[\]^_`abcdefghijklmnopqrstuvwxyz{|}~
    const CODE_a = `a`.charCodeAt(0);
    const CODE_z = `z`.charCodeAt(0);
    const CODE_A = `A`.charCodeAt(0);
    const CODE_Z = `Z`.charCodeAt(0);
    const CODE_0 = `0`.charCodeAt(0);
    const CODE_9 = `9`.charCodeAt(0);
    const CODE_EXCL_MARK = `!`.charCodeAt(0);
    const CODE_SLASH = `/`.charCodeAt(0);
    const CODE_COLON = `:`.charCodeAt(0);
    const CODE_AT = `@`.charCodeAt(0);
    const CODE_SQ_BKT = `[`.charCodeAt(0);
    const CODE_CARET = `\``.charCodeAt(0);
    const CODE_CURLY_BKT = `{`.charCodeAt(0);
    const CODE_TILDE = `~`.charCodeAt(0);
    const CODE_START_UNICODE = 127;

    /**
     * @param {number} charCode
     * @returns {boolean}
     */
    function _isUpperCase(charCode) {
      return charCode >= CODE_A && charCode <= CODE_Z;
    }

    /**
     * @param {number} charCode
     * @returns {boolean}
     */
    function _isCodeAlphaNum(charCode) {
      // 0 - 126 charCodes are ascii, 127 onwards are unicode code points
      return (
        (charCode >= CODE_a && charCode <= CODE_z) ||
        _isUpperCase(charCode) ||
        (charCode >= CODE_0 && charCode <= CODE_9) ||
        charCode >= CODE_START_UNICODE
      );
    }

    /**
     * @param {number} charCode
     * @returns {boolean}
     */
    function _isCodePunctuation(charCode) {
      // rather than create a uint8 typed array as a lookup table
      // uglifyjs inlines this function in prod builds. JIT should inline too.
      // we're calling it charCode rather than 'code' because of an uglifyjs bug
      // see: https://github.com/mishoo/UglifyJS2/issues/2842
      return (
        (charCode >= CODE_EXCL_MARK && charCode <= CODE_SLASH) ||
        (charCode >= CODE_COLON && charCode <= CODE_AT) ||
        (charCode >= CODE_SQ_BKT && charCode <= CODE_CARET) ||
        (charCode >= CODE_CURLY_BKT && charCode <= CODE_TILDE)
      );
    }

    /**
     * A skip index marks word and punctuation boundaries
     * We use this to skip around the targetStr and quickly find prefix matches
     * @param {string} targetStr
     * @returns {number[]}
     */
    function _getTargetSkips(targetStr) {
      const targetSkips = [];
      let wasAlphaNum = false;
      let wasUpperCase = false;

      for (let i = 0, len = targetStr.length; i < len; ++i) {
        const code = targetStr.charCodeAt(i);
        const isAlphaNum = _isCodeAlphaNum(code);
        const isUpperCase = _isUpperCase(code);

        if ((isAlphaNum && !wasAlphaNum) || (isUpperCase && !wasUpperCase) || _isCodePunctuation(code)) {
          targetSkips.push(i);
        }

        wasAlphaNum = isAlphaNum;
        wasUpperCase = isUpperCase;
      }

      // We push the length as the last skip so when matching
      // every range aligns between skip[i] and skip[i + 1]
      // and we don't have to do extraneous overflow checks
      targetSkips.push(targetStr.length);

      // NOTE: these can possibly be cached on the items for a faster search next time
      return targetSkips;
    }

    /**
     * performs a prefix match e.g 'usam' matches '[u]nited [s]tates of [am]erica
     * @param {number} skipIdx - skip index where to start search from
     * @param {string} searchStr - lowercased search string
     * @param {string} targetStr - lowercased target string
     * @param {number[]} targetSkips - skip boundary indices
     * @returns {number[] | null}
     *  - the [idx, len, ...] ranges where the match occured
     *  - null if no match found
     */
    function _fuzzyPrefixMatch(skipIdx, searchStr, targetStr, targetSkips) {
      let searchIdx = 0;
      const searchLen = searchStr.length;
      /** @type {number[]} */
      const ranges = [];

      for (let skipLen = targetSkips.length - 1; skipIdx < skipLen; ++skipIdx) {
        const startIdx = targetSkips[skipIdx];
        const endIdx = targetSkips[skipIdx + 1];
        let targetIdx = startIdx;
        let matchLen = 0;

        while (targetIdx < endIdx && searchIdx < searchLen) {
          const targetChar = targetStr[targetIdx];
          const searchChar = searchStr[searchIdx];

          if (targetChar === searchChar) {
            ++targetIdx;
            ++searchIdx;
            ++matchLen;
            continue;
          }

          // spaces shouldn't break matching
          if (targetChar === ` `) {
            ++targetIdx;
            continue;
          }
          if (searchChar === ` `) {
            ++searchIdx;
            continue;
          }

          break;
        }

        if (matchLen) {
          // make contiguous ranges if possible
          const rangesLen = ranges.length;
          if (rangesLen >= 2 && ranges[rangesLen - 2] + ranges[rangesLen - 1] === startIdx) {
            ranges[rangesLen - 1] += matchLen;
          } else {
            ranges.push(startIdx, matchLen);
          }
        }

        if (searchIdx === searchLen) {
          // search is fully matched, return ranges
          return ranges;
        }
      }

      return null;
    }

    /**
     * Returns the string parts for highlighting from the matched ranges
     * @example ('my example', [3, 2]) would return ['my ', 'ex', 'ample']
     * @param {string} targetStr - the string that was matched
     * @param {number[]} ranges - [idx1, len1, idx2, len2] matched ranges
     * @returns {string[]} - ['no match', 'match', 'no match', 'match']
     */
    function highlightsFromRanges(targetStr, ranges) {
      const highlights = [];
      let lastIndex = 0;
      let rangesIdx = 0;

      for (; rangesIdx < ranges.length; rangesIdx += 2) {
        const startIndex = ranges[rangesIdx];
        const endIndex = startIndex + ranges[rangesIdx + 1];
        highlights.push(targetStr.slice(lastIndex, startIndex));
        highlights.push(targetStr.slice(startIndex, endIndex));
        lastIndex = endIndex;
      }

      if (lastIndex < targetStr.length) {
        highlights.push(targetStr.slice(lastIndex));
      }

      return highlights;
    }

    /**
     * fuzzyScoreItem is called by fuzzyMatch, it's a slightly lower level call
     * If perf is of importance and you want to avoid lowercase + trim + highlighting on every item
     * Use this and only call highlightsFromRanges for only the items that are displayed
     * @param {string} targetStr - lowercased trimmed target string to search on
     * @param {string} searchStr - lowercased trimmed search string
     * @returns {{score: number, ranges: number[]} | null} - null if no match
     */
    function fuzzyScoreItem(targetStr, searchStr) {
      if (!targetStr) {
        return null;
      }

      // empty search string is technically a match of nothing
      if (!searchStr) {
        return {
          score: 0,
          ranges: [],
        };
      }

      // if user enters a quoted search then only perform substring match
      // e.g "la matches [{La}s Vegas] but not [Los Angeles]
      // NOTE: ending quote is optional so user can get incremental matching as they type.
      const isQuotedSearchStr = searchStr[0] === '"';
      if (isQuotedSearchStr) {
        searchStr = searchStr.slice(1, searchStr.endsWith(`"`) ? -1 : searchStr.length);
      }

      // try substring search first
      // js engine uses boyer moore algo which is very fast O(m/n)
      const lCaseTargetStr = targetStr.toLowerCase();
      const matchIdx = lCaseTargetStr.indexOf(searchStr);
      const searchLen = searchStr.length;

      if (matchIdx >= 0) {
        const isWordPrefix = matchIdx > 0 && !_isCodeAlphaNum(targetStr.charCodeAt(matchIdx - 1));
        return {
          score: _getMatchScore(matchIdx, searchLen, isWordPrefix),
          ranges: [matchIdx, searchLen],
        };
      }

      // if we didn't match a single character as a substr, we won't fuzzy match it either, exit early.
      // if quoted search, exit after substring search as well, since user doesn't want fuzzy search.
      if (searchLen === 1 || isQuotedSearchStr) {
        return null;
      }

      // fall back to fuzzy matching which matches word prefixes or punctuations
      // because we've precomputed targetSkips, its O(m+n) for avg case
      // the skip array helps us make faster alignments, rather than letter by letter
      const targetSkips = _getTargetSkips(targetStr);

      for (let skipIdx = 0, skipLen = targetSkips.length - 1; skipIdx < skipLen; ++skipIdx) {
        if (lCaseTargetStr[targetSkips[skipIdx]] === searchStr[0]) {
          // possible alignment, perform prefix match
          const ranges = _fuzzyPrefixMatch(skipIdx, searchStr, lCaseTargetStr, targetSkips);
          if (ranges) {
            let score = 0;
            for (let i = 0, len = ranges.length; i < len; i += 2) {
              score += _getMatchScore(ranges[i], ranges[i + 1], true /*isWordPrefix*/);
            }
            return {score, ranges};
          }
        }
      }

      return null;
    }

    /**
     * Fuzzy match and return the score, highlights, and lowercased matchStr (for sort)
     * @param {string} targetStr - target to search on / haystack string
     * @param {string} searchStr - search filter / needle string
     * @returns {{score: number, highlights: string[]} | null} - null if no match
     */
    function fuzzyMatch(targetStr, searchStr) {
      targetStr = targetStr || ``;
      searchStr = (searchStr || ``).trim().toLowerCase();
      const match = fuzzyScoreItem(targetStr, searchStr);

      if (match) {
        return {
          score: match.score,
          highlights: highlightsFromRanges(targetStr, match.ranges),
        };
      }

      return null;
    }

    /**
     * @template Item
     * @typedef {{item: Item, score: number, highlights: {[K in keyof Item]?: string[]}}} FuzzyFilterResult
     */

    /**
     * Searches an array of items on props and returns filtered + sorted array with scores and highlights
     * @template Item
     * @param {Item[]} items
     * @param {string} searchStr
     * @param {{fields: (keyof Item)[]}} options
     * @returns {FuzzyFilterResult<Item>[]}
     */
    function fuzzyFilter(items, searchStr, options) {
      /** @type {FuzzyFilterResult<Item>[]} */
      const results = [];
      const searchStrLowerCased = (searchStr || ``).trim().toLowerCase();
      const fields = options ? options.fields : null;
      if (!fields || !Array.isArray(fields) || fields.length == 0) {
        throw new Error(`invalid fields, did you forget to pass {fields: [...]} as options param?`);
      }

      for (const item of items) {
        /** @type {FuzzyFilterResult<Item> | null} */
        let result = null;
        for (const field of fields) {
          const value = item[field];
          if (typeof value === `string` && value) {
            const match = fuzzyScoreItem(value, searchStrLowerCased);
            if (match) {
              result = result || {item, score: 0, highlights: {}};
              result.score = Math.max(match.score, result.score);
              result.highlights[field] = highlightsFromRanges(value, match.ranges);
            }
          }
        }
        if (result) {
          results.push(result);
        }
      }

      // sort if searchStr is not empty, otherwise preserve original order, since its a pass through
      if (searchStrLowerCased) {
        results.sort((a, b) => {
          // sort by score, then alphabetically by each field
          let diff = b.score - a.score;
          for (let i = 0, len = fields.length; diff === 0 && i < len; ++i) {
            const field = fields[i];
            const valA = a.item[field];
            const valB = b.item[field];
            // @ts-ignore string comparison
            diff = (valA || ``).localeCompare(valB);
          }
          return diff;
        });
      }

      return results;
    }

    exports.fuzzyFilter = fuzzyFilter;
    exports.fuzzyMatch = fuzzyMatch;
    exports.fuzzyScoreItem = fuzzyScoreItem;
    exports.highlightsFromRanges = highlightsFromRanges;

    return exports;

  })({});