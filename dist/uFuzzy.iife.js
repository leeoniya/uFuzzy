/**
* Copyright (c) 2025, Leon Sorokin
* All rights reserved. (MIT Licensed)
*
* uFuzzy.js (μFuzzy)
* A tiny, efficient fuzzy matcher that doesn't suck
* https://github.com/leeoniya/uFuzzy (v1.0.11)
*/

var uFuzzy = function () {
  'use strict';

  var cmp = new Intl.Collator('en').compare;
  var inf = Infinity;

  // https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Regular_expressions#escaping
  var escapeRegExp = function escapeRegExp(str) {
    return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  };

  // meh, magic tmp placeholder, must be tolerant to toLocaleLowerCase(), interSplit, and intraSplit
  var EXACT_HERE = 'eexxaacctt';
  var sort = function sort(info, haystack, needle) {
    var idx = info.idx,
      chars = info.chars,
      terms = info.terms,
      interLft2 = info.interLft2,
      interLft1 = info.interLft1,
      start = info.start,
      intraIns = info.intraIns,
      interIns = info.interIns;
    return idx.map(function (v, i) {
      return i;
    }).sort(function (ia, ib) {
      return (
        // most contig chars matched
        chars[ib] - chars[ia] ||
        // least char intra-fuzz (most contiguous)
        intraIns[ia] - intraIns[ib] ||
        // most prefix bounds, boosted by full term matches

        terms[ib] + interLft2[ib] + 0.5 * interLft1[ib] - (terms[ia] + interLft2[ia] + 0.5 * interLft1[ia]) ||
        // highest density of match (least span)
        //	span[ia] - span[ib] ||
        // highest density of match (least term inter-fuzz)
        interIns[ia] - interIns[ib] ||
        // earliest start of match
        start[ia] - start[ib] ||
        // alphabetic
        cmp(haystack[idx[ia]], haystack[idx[ib]])
      );
    });
  };
  var lazyRepeat = function lazyRepeat(chars, limit) {
    return limit == 0 ? '' : limit == 1 ? chars + '??' : limit == inf ? chars + '*?' : chars + "{0,".concat(limit, "}?");
  };
  function uFuzzy() {
    var _interSplit = "[^A-Za-z\\d']+";
    var _intraSplit = "[a-z][A-Z]";
    var _intraBound = "[A-Za-z]\\d|\\d[A-Za-z]|[a-z][A-Z]";
    var interChars = '.';
    var interIns = inf;
    var intraChars = "[\\w-]";
    var intraIns = 1;
    var intraContr = "'[a-z]{1,2}\\b";
    var intraSlice = [1, inf];
    var intraSub = 1;
    var intraTrn = 1;
    var intraDel = 1;
    var uFlag = '';
    var quotedAny = '".+?"';
    var EXACTS_RE = new RegExp(quotedAny, 'gi' + uFlag);
    var NEGS_RE = new RegExp("(?:\\s+|^)-(?:".concat(intraChars, "+|").concat(quotedAny, ")"), 'gi' + uFlag);
    var intraRules = null;
    if (intraRules == null) {
      intraRules = function intraRules(p) {
        // default is exact term matches only
        var _intraSlice = intraSlice,
          // requires first char
          _intraIns = 0,
          _intraSub = 0,
          _intraTrn = 0,
          _intraDel = 0;
        var plen = p.length;

        // prevent junk matches by requiring stricter rules for short terms
        if (plen <= 4) {
          if (plen >= 3) {
            // one swap in non-first char when 3-4 chars
            _intraTrn = Math.min(intraTrn, 1);

            // or one insertion when 4 chars
            if (plen == 4) _intraIns = Math.min(intraIns, 1);
          }
          // else exact match when 1-2 chars
        }
        // use supplied opts
        else {
          _intraSlice = intraSlice;
          _intraIns = intraIns, _intraSub = intraSub, _intraTrn = intraTrn, _intraDel = intraDel;
        }
        return {
          intraSlice: _intraSlice,
          intraIns: _intraIns,
          intraSub: _intraSub,
          intraTrn: _intraTrn,
          intraDel: _intraDel
        };
      };
    }
    var intraSplit = new RegExp(_intraSplit, 'g' + uFlag);
    var interSplit = new RegExp(_interSplit, 'g' + uFlag);
    var trimRe = new RegExp('^' + _interSplit + '|' + _interSplit + '$', 'g' + uFlag);
    var contrsRe = new RegExp(intraContr, 'gi' + uFlag);
    var split = function split(needle) {
      var exacts = [];
      needle = needle.replace(EXACTS_RE, function (m) {
        exacts.push(m);
        return EXACT_HERE;
      });
      needle = needle.replace(trimRe, '').toLocaleLowerCase();
      needle = needle.replace(intraSplit, function (m) {
        return m[0] + ' ' + m[1];
      });
      var j = 0;
      return needle.split(interSplit).filter(function (t) {
        return t != '';
      }).map(function (v) {
        return v === EXACT_HERE ? exacts[j++] : v;
      });
    };
    var prepQuery = function prepQuery(needle) {
      var capt = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : 0;
      var interOR = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : false;
      // split on punct, whitespace, num-alpha, and upper-lower boundaries
      var parts = split(needle);
      if (parts.length == 0) return [];

      // split out any detected contractions for each term that become required suffixes
      var contrs = Array(parts.length).fill('');
      parts = parts.map(function (p, pi) {
        return p.replace(contrsRe, function (m) {
          contrs[pi] = m;
          return '';
        });
      });

      // array of regexp tpls for each term
      var reTpl;

      // allows single mutations within each term
      {
        reTpl = parts.map(function (p, pi) {
          var _intraRules = intraRules(p),
            intraSlice = _intraRules.intraSlice,
            intraIns = _intraRules.intraIns,
            intraSub = _intraRules.intraSub,
            intraTrn = _intraRules.intraTrn,
            intraDel = _intraRules.intraDel;
          if (intraIns + intraSub + intraTrn + intraDel == 0) return p + contrs[pi];
          if (p[0] === '"') return escapeRegExp(p.slice(1, -1));
          var lftIdx = intraSlice[0];
          var rgtIdx = intraSlice[1];
          var lftChar = p.slice(0, lftIdx); // prefix
          var rgtChar = p.slice(rgtIdx); // suffix

          var chars = p.slice(lftIdx, rgtIdx);

          // neg lookahead to prefer matching 'Test' instead of 'tTest' in ManifestTest or fittest
          // but skip when search term contains leading repetition (aardvark, aaa)
          if (intraIns == 1 && lftChar.length == 1 && lftChar != chars[0]) lftChar += '(?!' + lftChar + ')';
          var numChars = chars.length;
          var variants = [p];

          // variants with single char substitutions
          if (intraSub) {
            for (var i = 0; i < numChars; i++) variants.push(lftChar + chars.slice(0, i) + intraChars + chars.slice(i + 1) + rgtChar);
          }

          // variants with single transpositions
          if (intraTrn) {
            for (var _i = 0; _i < numChars - 1; _i++) {
              if (chars[_i] != chars[_i + 1]) variants.push(lftChar + chars.slice(0, _i) + chars[_i + 1] + chars[_i] + chars.slice(_i + 2) + rgtChar);
            }
          }

          // variants with single char omissions
          if (intraDel) {
            for (var _i2 = 0; _i2 < numChars; _i2++) variants.push(lftChar + chars.slice(0, _i2 + 1) + '?' + chars.slice(_i2 + 1) + rgtChar);
          }

          // variants with single char insertions
          if (intraIns) {
            var intraInsTpl = lazyRepeat(intraChars, 1);
            for (var _i3 = 0; _i3 < numChars; _i3++) variants.push(lftChar + chars.slice(0, _i3) + intraInsTpl + chars.slice(_i3) + rgtChar);
          }
          var reTpl = '(?:' + variants.join('|') + ')' + contrs[pi];

          //	console.log(reTpl);

          return reTpl;
        });
      }

      //	console.log(reTpl);

      // this only helps to reduce initial matches early when they can be detected
      // TODO: might want a mode 3 that excludes _
      var preTpl = '';
      var sufTpl = '';
      var interCharsTpl = sufTpl + lazyRepeat(interChars, interIns) + preTpl;

      // capture at word level
      if (capt > 0) {
        if (interOR) {
          // this is basically for doing .matchAll() occurence counting and highlighting without needing permuted ooo needles
          reTpl = preTpl + '(' + reTpl.join(')' + sufTpl + '|' + preTpl + '(') + ')' + sufTpl;
        } else {
          // sadly, we also have to capture the inter-term junk via parenth-wrapping .*?
          // to accum other capture groups' indices for \b boosting during scoring
          reTpl = '(' + reTpl.join(')(' + interCharsTpl + ')(') + ')';
          reTpl = '(.??' + preTpl + ')' + reTpl + '(' + sufTpl + '.*)'; // nit: trailing capture here assumes interIns = Inf
        }
      } else {
        reTpl = reTpl.join(interCharsTpl);
        reTpl = preTpl + reTpl + sufTpl;
      }

      //	console.log(reTpl);

      return [new RegExp(reTpl, 'i' + uFlag), parts, contrs];
    };
    var filter = function filter(haystack, needle, idxs) {
      var query = prepQuery(needle)[0];
      if (query == null) return null;
      var out = [];
      if (idxs != null) {
        for (var i = 0; i < idxs.length; i++) {
          var idx = idxs[i];
          query.test(haystack[idx]) && out.push(idx);
        }
      } else {
        for (var _i4 = 0; _i4 < haystack.length; _i4++) query.test(haystack[_i4]) && out.push(_i4);
      }
      return out;
    };
    var interBound = new RegExp(_interSplit, uFlag);
    var intraBound = new RegExp(_intraBound, uFlag);
    var info = function info(idxs, haystack, needle) {
      var _prepQuery = prepQuery(needle, 1);
      var query = _prepQuery[0];
      var parts = _prepQuery[1];
      var contrs = _prepQuery[2];
      var queryR = prepQuery(needle, 2)[0];
      var partsLen = parts.length;
      var len = idxs.length;
      var field = Array(len).fill(0);
      var info = {
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
        interIns: field.slice(),
        // between terms
        intraIns: field.slice(),
        // within terms

        // interLft/interRgt counters
        interLft2: field.slice(),
        interRgt2: field.slice(),
        interLft1: field.slice(),
        interRgt1: field.slice(),
        ranges: Array(len)
      };
      var ii = 0;
      for (var i = 0; i < idxs.length; i++) {
        var mhstr = haystack[idxs[i]];

        // the matched parts are [full, junk, term, junk, term, junk]
        var m = mhstr.match(query);

        // leading junk
        var start = m.index + m[1].length;
        var idxAcc = start;
        var lft2 = 0;
        var lft1 = 0;
        var rgt2 = 0;
        var rgt1 = 0;
        var chars = 0;
        var terms = 0;
        var inter = 0;
        var intra = 0;
        var refine = [];
        for (var j = 0, k = 2; j < partsLen; j++, k += 2) {
          var group = m[k].toLocaleLowerCase();
          var part = parts[j];
          var term = part[0] == '"' ? part.slice(1, -1) : part + contrs[j];
          var termLen = term.length;
          var groupLen = group.length;
          var fullMatch = group == term;

          // this won't handle the case when an exact match exists across the boundary of the current group and the next junk
          // e.g. blob,ob when searching for 'bob' but finding the earlier `blob` (with extra insertion)
          if (!fullMatch && m[k + 1].length >= termLen) {
            // probe for exact match in inter junk (TODO: maybe even in this matched part?)
            var idxOf = m[k + 1].toLocaleLowerCase().indexOf(term);
            if (idxOf > -1) {
              refine.push(idxAcc, groupLen, idxOf, termLen);
              idxAcc += refineMatch(m, k, idxOf, termLen);
              group = term;
              groupLen = termLen;
              fullMatch = true;
              if (j == 0) start = idxAcc;
            }
          }
          if (fullMatch) {
            // does group's left and/or right land on \b
            var lftCharIdx = idxAcc - 1;
            var rgtCharIdx = idxAcc + groupLen;
            var isPre = false;
            var isSuf = false;

            // prefix info
            if (lftCharIdx == -1 || interBound.test(mhstr[lftCharIdx])) {
              fullMatch && lft2++;
              isPre = true;
            } else {
              if (intraBound.test(mhstr[lftCharIdx] + mhstr[lftCharIdx + 1])) {
                fullMatch && lft1++;
                isPre = true;
              }
            }

            // suffix info
            if (rgtCharIdx == mhstr.length || interBound.test(mhstr[rgtCharIdx])) {
              fullMatch && rgt2++;
              isSuf = true;
            } else {
              if (intraBound.test(mhstr[rgtCharIdx - 1] + mhstr[rgtCharIdx])) {
                fullMatch && rgt1++;
                isSuf = true;
              }
            }
            if (fullMatch) {
              chars += termLen;
              if (isPre && isSuf) terms++;
            }
          }
          if (groupLen > termLen) intra += groupLen - termLen; // intraFuzz

          if (j > 0) inter += m[k - 1].length; // interFuzz

          if (j < partsLen - 1) idxAcc += groupLen + m[k + 1].length;
        }
        {
          info.idx[ii] = idxs[i];
          info.interLft2[ii] = lft2;
          info.interLft1[ii] = lft1;
          info.interRgt2[ii] = rgt2;
          info.interRgt1[ii] = rgt1;
          info.chars[ii] = chars;
          info.terms[ii] = terms;
          info.interIns[ii] = inter;
          info.intraIns[ii] = intra;
          info.start[ii] = start;
          //	info.span[ii] = span;

          // ranges
          var _m = mhstr.match(queryR);
          var _idxAcc = _m.index + _m[1].length;
          var refLen = refine.length;
          var ri = refLen > 0 ? 0 : Infinity;
          var lastRi = refLen - 4;
          for (var _i5 = 2; _i5 < _m.length;) {
            var _len2 = _m[_i5].length;
            if (ri <= lastRi && refine[ri] == _idxAcc) {
              var _groupLen = refine[ri + 1];
              var _idxOf = refine[ri + 2];
              var _termLen = refine[ri + 3];

              // advance to end of original (full) group match that includes intra-junk
              var _j = _i5;
              var v = '';
              for (var _len = 0; _len < _groupLen; _j++) {
                v += _m[_j];
                _len += _m[_j].length;
              }
              _m.splice(_i5, _j - _i5, v);
              _idxAcc += refineMatch(_m, _i5, _idxOf, _termLen);
              ri += 4;
            } else {
              _idxAcc += _len2;
              _i5++;
            }
          }
          _idxAcc = _m.index + _m[1].length;
          var ranges = info.ranges[ii] = [];
          var from = _idxAcc;
          var to = _idxAcc;
          for (var _i6 = 2; _i6 < _m.length; _i6++) {
            var _len3 = _m[_i6].length;
            _idxAcc += _len3;
            if (_i6 % 2 == 0) to = _idxAcc;else if (_len3 > 0) {
              ranges.push(from, to);
              from = to = _idxAcc;
            }
          }
          if (to > from) ranges.push(from, to);
          ii++;
        }
      }

      // trim arrays
      if (ii < idxs.length) {
        for (var _k in info) info[_k] = info[_k].slice(0, ii);
      }
      return info;
    };
    var refineMatch = function refineMatch(m, k, idxInNext, termLen) {
      // shift the current group into the prior junk
      var prepend = m[k] + m[k + 1].slice(0, idxInNext);
      m[k - 1] += prepend;
      m[k] = m[k + 1].slice(idxInNext, idxInNext + termLen);
      m[k + 1] = m[k + 1].slice(idxInNext + termLen);
      return prepend.length;
    };
    var OOO_TERMS_LIMIT = 5;

    // returns [idxs, info, order]
    var _search = function _search(haystack, needle, outOfOrder) {
      var infoThresh = arguments.length > 3 && arguments[3] !== undefined ? arguments[3] : 1e3;
      var preFiltered = arguments.length > 4 ? arguments[4] : undefined;
      var _ref;
      outOfOrder = !outOfOrder ? 0 : outOfOrder === true ? OOO_TERMS_LIMIT : outOfOrder;
      var needles = null;
      var matches = null;
      var negs = [];
      needle = needle.replace(NEGS_RE, function (m) {
        var neg = m.trim().slice(1);
        if (neg[0] === '"') neg = escapeRegExp(neg.slice(1, -1));
        negs.push(neg);
        return '';
      });
      var terms = split(needle);
      var negsRe;
      if (negs.length > 0) {
        negsRe = new RegExp(negs.join('|'), 'i' + uFlag);
        if (terms.length == 0) {
          var idxs = [];
          for (var i = 0; i < haystack.length; i++) {
            if (!negsRe.test(haystack[i])) idxs.push(i);
          }
          return [idxs, null, null];
        }
      } else {
        // abort search (needle is empty after pre-processing, e.g. no alpha-numeric chars)
        if (terms.length == 0) return [null, null, null];
      }

      //	console.log(negs);
      //	console.log(needle);

      if (outOfOrder > 0) {
        // since uFuzzy is an AND-based search, we can iteratively pre-reduce the haystack by searching
        // for each term in isolation before running permutations on what's left.
        // this is a major perf win. e.g. searching "test man ger pp a" goes from 570ms -> 14ms
        var _terms = split(needle);
        if (_terms.length > 1) {
          // longest -> shortest
          var terms2 = _terms.slice().sort(function (a, b) {
            return b.length - a.length;
          });
          for (var ti = 0; ti < terms2.length; ti++) {
            var _preFiltered;
            // no haystack item contained all terms
            if (((_preFiltered = preFiltered) === null || _preFiltered === void 0 ? void 0 : _preFiltered.length) == 0) return [[], null, null];
            preFiltered = filter(haystack, terms2[ti], preFiltered);
          }

          // avoid combinatorial explosion by limiting outOfOrder to 5 terms (120 max searches)
          // fall back to just filter() otherwise
          if (_terms.length > outOfOrder) return [preFiltered, null, null];
          needles = permute(_terms).map(function (perm) {
            return perm.join(' ');
          });

          // filtered matches for each needle excluding same matches for prior needles
          matches = [];

          // keeps track of already-matched idxs to skip in follow-up permutations
          var matchedIdxs = new Set();
          for (var ni = 0; ni < needles.length; ni++) {
            if (matchedIdxs.size < preFiltered.length) {
              // filter further for this needle, exclude already-matched
              var preFiltered2 = preFiltered.filter(function (idx) {
                return !matchedIdxs.has(idx);
              });
              var matched = filter(haystack, needles[ni], preFiltered2);
              for (var j = 0; j < matched.length; j++) matchedIdxs.add(matched[j]);
              matches.push(matched);
            } else matches.push([]);
          }
        }
      }

      // interOR
      //	console.log(prepQuery(needle, 1, null, true));

      // non-ooo or ooo w/single term
      if (needles == null) {
        var _preFiltered2;
        needles = [needle];
        matches = [((_preFiltered2 = preFiltered) === null || _preFiltered2 === void 0 ? void 0 : _preFiltered2.length) > 0 ? preFiltered : filter(haystack, needle)];
      }
      var retInfo = null;
      var retOrder = null;
      if (negs.length > 0) matches = matches.map(function (idxs) {
        return idxs.filter(function (idx) {
          return !negsRe.test(haystack[idx]);
        });
      });
      var matchCount = matches.reduce(function (acc, idxs) {
        return acc + idxs.length;
      }, 0);

      // rank, sort, concat
      if (matchCount <= infoThresh) {
        retInfo = {};
        retOrder = [];
        for (var _ni = 0; _ni < matches.length; _ni++) {
          var _idxs = matches[_ni];
          if (_idxs == null || _idxs.length == 0) continue;
          var _needle = needles[_ni];
          var _info = info(_idxs, haystack, _needle);
          var order = sort(_info, haystack);

          // offset idxs for concat'ing infos
          if (_ni > 0) {
            for (var _i7 = 0; _i7 < order.length; _i7++) order[_i7] += retOrder.length;
          }
          for (var k in _info) {
            var _retInfo$k;
            retInfo[k] = ((_retInfo$k = retInfo[k]) !== null && _retInfo$k !== void 0 ? _retInfo$k : []).concat(_info[k]);
          }
          retOrder = retOrder.concat(order);
        }
      }
      return [(_ref = []).concat.apply(_ref, matches), retInfo, retOrder];
    };
    return {
      search: function search() {
        var out = _search.apply(void 0, arguments);
        return out;
      },
      split: split,
      filter: filter,
      info: info,
      sort: sort
    };
  }
  var latinize = function () {
    var accents = {
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
      C: 'ÇČ',
      c: 'çč',
      N: 'Ñ',
      n: 'ñ',
      S: 'Š',
      s: 'š'
    };
    var accentsMap = new Map();
    var accentsTpl = '';
    var _loop = function _loop(r) {
      accents[r].split('').forEach(function (a) {
        accentsTpl += a;
        accentsMap.set(a, r);
      });
    };
    for (var r in accents) {
      _loop(r);
    }
    var accentsRe = new RegExp("[".concat(accentsTpl, "]"), 'g');
    var replacer = function replacer(m) {
      return accentsMap.get(m);
    };
    return function (strings) {
      if (typeof strings == 'string') return strings.replace(accentsRe, replacer);
      var out = Array(strings.length);
      for (var i = 0; i < strings.length; i++) out[i] = strings[i].replace(accentsRe, replacer);
      return out;
    };
  }();

  // https://stackoverflow.com/questions/9960908/permutations-in-javascript/37580979#37580979
  function permute(arr) {
    arr = arr.slice();
    var length = arr.length,
      result = [arr.slice()],
      c = new Array(length).fill(0),
      i = 1,
      k,
      p;
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
  var _mark = function _mark(part, matched) {
    return matched ? "<mark>".concat(part, "</mark>") : part;
  };
  var _append = function _append(acc, part) {
    return acc + part;
  };
  function highlight(str, ranges) {
    var _append2, _append5;
    var mark = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : _mark;
    var accum = arguments.length > 3 && arguments[3] !== undefined ? arguments[3] : '';
    var append = arguments.length > 4 && arguments[4] !== undefined ? arguments[4] : _append;
    accum = (_append2 = append(accum, mark(str.substring(0, ranges[0]), false))) !== null && _append2 !== void 0 ? _append2 : accum;
    for (var i = 0; i < ranges.length; i += 2) {
      var _append3, _append4;
      var fr = ranges[i];
      var to = ranges[i + 1];
      accum = (_append3 = append(accum, mark(str.substring(fr, to), true))) !== null && _append3 !== void 0 ? _append3 : accum;
      if (i < ranges.length - 3) accum = (_append4 = append(accum, mark(str.substring(ranges[i + 1], ranges[i + 2]), false))) !== null && _append4 !== void 0 ? _append4 : accum;
    }
    accum = (_append5 = append(accum, mark(str.substring(ranges[ranges.length - 1]), false))) !== null && _append5 !== void 0 ? _append5 : accum;
    return accum;
  }
  uFuzzy.latinize = latinize;
  uFuzzy.permute = function (arr) {
    var idxs = permute(Array.from(Array(arr.length).keys())).sort(function (a, b) {
      for (var i = 0; i < a.length; i++) {
        if (a[i] != b[i]) return a[i] - b[i];
      }
      return 0;
    });
    return idxs.map(function (pi) {
      return pi.map(function (i) {
        return arr[i];
      });
    });
  };
  uFuzzy.highlight = highlight;
  return uFuzzy;
}();
