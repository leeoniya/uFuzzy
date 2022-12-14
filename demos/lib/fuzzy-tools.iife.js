/**
* Copyright (c) 2022, Denis Shelest
* All rights reserved. (MIT Licensed)
*
* fuzzy-tools.js
* https://github.com/axules/fuzzy-tools (v2.0.1)
*/

var FuzzyTools = (function (exports) {
  'use strict';

  const DEFAULT_OPTIONS = {
    caseSensitive: false,
    withScore: false,
    withWrapper: null,
    withRanges: false,
    itemWrapper: null,
    rates: {},
  };

  function defaultOptions(options) {
    return options ? { ...DEFAULT_OPTIONS, ...options } : DEFAULT_OPTIONS;
  }

  function isFunction(value) {
    return typeof value === 'function';
  }

  function isObject(value) {
    return typeof value === 'object';
  }

  function isString(value) {
    return typeof value === 'string';
  }

  function getValue(obj, keys = []) {
    if (!obj || !isObject(obj)) return undefined;
    let value = obj;
    const keysList = Array.isArray(keys) ? keys : String(keys).split('.');
    while (keysList.length && value) {
      const k = keysList.shift();
      value = !value || !isObject(value) ? undefined : value[k];
    }
    return value;
  }

  function getDataExtractor(fields) {
    if (!fields) return null;
    const fieldsList = Object.entries(
      Array.isArray(fields)
        ? fields.reduce((R, el) => Object.assign(R, { [el]: 1 }), {})
        : isObject(fields)
          ? fields
          : { [fields]: 1 }
    ).map(([k, rate]) => ({
      rate: parseFloat(rate) || 1,
      field: k,
      path: k
    }));
    if (fieldsList.length == 0) return null;
    return (value) => {
      if (isString(fields)) return getValue(value, fields);
      return fieldsList.reduce(
        (R, el) => Object.assign(
          R,
          { [el.field]: el.rate === 1
            ? getValue(value, el.path)
            : { ...el, value: getValue(value, el.path) }
          }
        ),
        {}
      );
    };
  }

  function computeScore(begin, end, fullLength, wordNumber) {
    const wordLen = end - begin + 1;
    const kd = (1 / fullLength) * wordLen;
    const kp = begin || 0.001;
    const kw = 1 + (1 / fullLength) * wordNumber;
    return kd * kp * kw;
  }

  function matchString(what, where, options) {
    if (!what || !where) return null;
    const {
      caseSensitive,
      withScore,
      withWrapper,
      withRanges
    } = defaultOptions(options);
    const isWords = Array.isArray(what);
    if (isWords && what.length == 0) return null;

    const preparedWhat = caseSensitive
      ? (isWords ? what : String(what))
      : (isWords ? what.map(it => String(it).toLocaleLowerCase()) : String(what).toLocaleLowerCase());
    const originalWhere = String(where);
    if (!preparedWhat || !originalWhere || (!isWords && preparedWhat.length > originalWhere.length)) {
      return null;
    }
    // preparedWhere will be undefined if caseSensitive is true, it is needed to save memory
    const preparedWhere = caseSensitive ? undefined : originalWhere.toLocaleLowerCase();

    let wrapped = null;
    let ranges = null;
    let chunkBegin = 0;
    let scoreList = [];
    const wrapperFunc =
      !withWrapper || isFunction(withWrapper)
        ? withWrapper
        : (w) => withWrapper.replace('{?}', w);

    const wordAction = (prev, next) => {
      if (prev < 0) {
        if (withWrapper) {
          wrapped = next > 0 ? originalWhere.slice(0, next) : '';
        }
        if (withRanges) {
          ranges = [];
        }
        chunkBegin = next;
      } else if (next - prev > 1) {
        if (withWrapper) {
          const chunk = originalWhere.slice(chunkBegin, prev + 1);
          wrapped += wrapperFunc(chunk) + originalWhere.slice(prev + 1, next);
        }
        if (withRanges) {
          ranges.push({
            begin: chunkBegin,
            end: Math.min(prev, originalWhere.length - 1)
          });
        }
        if (withScore) {
          scoreList.push(
            computeScore(chunkBegin, prev, preparedWhat.length, scoreList.length)
          );
        }
        chunkBegin = next;
      }
    };

    let pos = -1;
    for (let i = 0; i < preparedWhat.length; i++) {
      const chunk = isWords ? preparedWhat[i] : preparedWhat.charAt(i);
      let nextPos = (preparedWhere || originalWhere).indexOf(chunk, pos + 1);

      if (nextPos < 0) return null;

      if (isWords && chunk.length > 1) {
        wordAction(pos, nextPos);
        nextPos = nextPos + chunk.length - 1;
        pos = nextPos - 1;
      }
      wordAction(pos, nextPos);
      pos = nextPos;
    }
    wordAction(pos, pos + originalWhere.length);

    return Object.assign(
      {
        score: withScore
          ? scoreList.reduce((p, c) => p + c, 0)
          : 1
      },
      withWrapper ? { wrapped } : {},
      withRanges ? { ranges } : {}
    );
  }

  function isValidRate(rate) {
    const result = rate == null || (rate > 0 && rate <= 1);
    if (!result) {
      console.warn(
        'fuzzy-tools',
        'rate should be `> 0` and `<= 1`, another value will be ignored. Current value: ',
        rate
      );
    }
    return result;
  }

  function matchList(what, whereList, options) {
    const isArray = Array.isArray(whereList);
    if (
      !what ||
      !whereList ||
      (!isArray && !isObject(whereList)) ||
      whereList.length == 0
    ) {
      return null;
    }

    const { withScore, rates } = defaultOptions(options);
    const results = Object.entries(whereList).reduce((R, [key, el]) => {
      const realKey = isArray ? Number(key) : key;
      const elValue = !el || isString(el) ? el : el.value;
      const elRate = el && isObject(el) && Object.prototype.hasOwnProperty.call(el, 'rate') && isValidRate(el.rate)
        ? el.rate
        : (rates && rates[realKey] != null && isValidRate(rates[realKey]) ? rates[realKey] : null);

      const result = matchString(what, elValue, options);
      if (result) {
        R[realKey] = Object.assign(
          result,
          { original: elValue, index: realKey },
          elRate == null
            ? {}
            : { score: result.score / elRate, rate: elRate }
        );
      }
      return R;
    }, {});

    if (Object.values(results).length === 0) return null;
    if (!withScore) return { score: 1, matches: results };

    const values = Object.values(results);
    return values.reduce(
      (R, el) => {
        R.score = Math.min(R.score, el.score);
        return R;
      },
      { score: Number.POSITIVE_INFINITY, matches: results }
    );
  }

  function match(what, where, options) {
    if (!what || !where) {
      return null;
    }
    return Array.isArray(where) || isObject(where)
      ? matchList(what, where, options)
      : matchString(what, where, options);
  }

  function filter(what, dataList, options) {
    if (!what || !dataList || !Array.isArray(dataList)) {
      return [];
    }
    const { extract, itemWrapper } = defaultOptions(options);
    const extractFunc =
      !extract || isFunction(extract) ? extract : getDataExtractor(extract);

    return dataList.reduce((R, row, i) => {
      const data = extract ? extractFunc(row) : row;
      const fuzzyResult = match(what, data, options);
      if (fuzzyResult) {
        const el = itemWrapper
          ? itemWrapper(row, fuzzyResult, { index: i, result: R })
          : row;
        if (el) {
          R.push(el);
        }
      }
      return R;
    }, []);
  }

  exports.filter = filter;
  exports.match = match;
  exports.matchList = matchList;
  exports.matchString = matchString;

  return exports;

})({});
