## ▒ μFuzzy

A tiny, efficient, fuzzy search that doesn't suck.
This is my fuzzy 🐈. [There are many like it](#a-biased-appraisal-of-similar-work), but this one is mine.

---
### Introduction

uFuzzy is a [fuzzy search](https://en.wikipedia.org/wiki/Approximate_string_matching) library designed to match a relatively short search phrase (needle) against a large list of short-to-medium phrases (haystack).
It might be best described as a more forgiving [String.prototype.indexOf()](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String/indexOf).
Its performance leaves significant headroom for matching fuzzy terms out-of-order by combining matches from all permutations of the needle.
When held _just right_, it can efficiently match against multiple properties, too.
Common use cases are list filtering, auto-complete/suggest, and title/name/description/filename/function searches.

uFuzzy is intolerant of missing terms, and missing or out-of-order characters, so is a poor fit for applications like spellcheck or fulltext/document search.

---
### Features

- **Junk-free, high quality results** that are _dataset-independent_. No need to fine-tune indexing options or boosting params to attain some arbitrary quality score cut-off.
- **Straightforward fuzziness control** that can be explained to your grandma in 5min.
- **Sorting you can reason about** and customize using a simple `Array.sort()` which gets access to each match's stats/counters. There's no composite, black box "score" to understand.
- **Concise set of options** that don't interact in mysterious ways to drastically alter combined behavior.
- **Fast with low resource usage** - there's no index to build, so startup is below 1ms with near-zero memory overhead. Searching a three-term phrase in a 162,000 phrase dataset takes 11ms or 35ms with out-of-order terms.
- **Micro, with zero dependencies** - currently [< 3KB min](https://github.com/leeoniya/uFuzzy/blob/main/dist/uFuzzy.iife.min.js)

---
### Demos

**NOTE:** The [testdata.json](https://github.com/leeoniya/uFuzzy/blob/main/demos/testdata.json) file is a diverse 162,000 string/phrase dataset 4MB in size, so first load may be slow due to network transfer.
Try refreshing once it's been cached by your browser.

First, uFuzzy in isolation to demonstrate its performance.

https://leeoniya.github.io/uFuzzy/demos/compare.html?libs=uFuzzy&search=super%20ma

Now the same comparison page, booted with [fuzzysort](https://github.com/farzher/fuzzysort), [QuickScore](https://fwextensions.github.io/quick-score-demo/), and [Fuse.js](https://fusejs.io/):

https://leeoniya.github.io/uFuzzy/demos/compare.html?libs=uFuzzy,fuzzysort,QuickScore,Fuse&search=super%20ma

Here is the full library list but with a reduced dataset (just `hearthstone_750`, `urls_and_titles_600`) to avoid crashing your browser:

https://leeoniya.github.io/uFuzzy/demos/compare.html?lists=hearthstone_750,urls_and_titles_600&search=moo

---
### Installation

### Node

```
npm i ufuzzy
```

```js
const uFuzzy = require('ufuzzy');
```

### Browser

```js
<script src="./dist/uFuzzy.iife.min.js"></script>
```

---
### Usage

uFuzzy works in 3 phases:

1. **Filter** - This filters the full `haystack` with a fast RegExp compiled from your `needle` without doing any extra ops. It returns an array of matched indices in original order.
2. **Info** - This collects more detailed stats about the filtered matches, such as start offsets, fuzz level, prefix/suffix counters, etc. It also gathers substring match positions for range highlighting. To do all this it re-compiles the `needle` into two more-expensive RegExps that can partition each of the filtered matches. Therefore, it should be run on a reduced subset of the haystack, usually returned by the Filter phase. The [uFuzzy demo](https://leeoniya.github.io/uFuzzy/demos/compare.html?libs=uFuzzy) is gated at <= 1,000 filtered items, before moving ahead with this Info phase.
3. **Sort** - This does an `Array.sort()` to determine final result order, probing the `info` object returned from the previous phase. A custom sort function can be provided via a uFuzzy option: `{sort: (info, haystack, needle) => idxsOrder}`.

```js
let haystack = [
    'puzzle',
    'Super Awesome Thing (now with stuff!)',
    'FileName.js',
    '/feeding/the/catPic.jpg',
];

let opts = {};

let uf = new uFuzzy(opts);

let needle = 'feed cat';

// pre-filter
let idxs = uf.filter(haystack, needle);

// sort/rank only when <= 1,000 items
if (idxs.length <= 1e3) {
  let info = uf.info(idxs, haystack, needle);

  // order is a double-indirection array (a re-order of the passed-in idxs)
  // this allows corresponding info to be grabbed directly by idx, if needed
  let order = uf.sort(info, haystack, needle);

  // render filtered & ordered matches
  for (let i = 0; i < order.length; i++) {
    console.log(haystack[idxs[order[i]]]);
  }
}
else {
  // render filtered but unordered matches
  for (let i = 0; i < idxs.length; i++) {
    console.log(haystack[i]);
  }
}
```

---
### A biased appraisal of similar work

Forget "apples and oranges"; comparing text search engines is more akin to "Cars vs Planes: A Toddler's Perspective".
However, that doesnt mean we cannot gain _some_ insight into a slice of operational behavior.
This assessment is extremely narrow and, of course, biased towards my use cases, text corpus, and my complete expertise in operating my own library.
It is highly probable that I'm not taking full advantage of some feature in other libraries that may significantly improve outcomes along some axis;
I welcome improvement PRs from anyone with deeper library knowledge than afforded by my hasty 10min skim over any "Basic usage" example and README doc.

#### Search quality

Can-of-worms #1.

Before we discuss [performance](#performance) let's talk about search quality, because speed is irrelevant when your results are a strange medly of "Oh yeah!" and "WTF?".

Search quality is very subjective.
What constitutes a good top match in a "typeahead/auto-suggest" case can be a poor match in a "search/find-all" scenario.
Some solutions optimize for the latter, some for the former.
It's common to find knobs that skew the results in either direction, but these are often by-feel and imperfect, being little more than a proxy to producing a single, composite match "score".

Let's take a look at some matches produced by the most popular fuzzy search library, [Fuse.js](https://github.com/krisk/Fuse) and a some others for which match highlighting is implemented in the demo.

TODO...

<!--
twil  0.1683 ok, 0.25+ bad
chest 0.1959 ok, 0.2+ bad
train
nin tur
puzz, puzl (MiniSearch, {fuzzy: 0.4}, uFuzzy, intraLimit: 1)
-->

#### Performance

Can-of-worms #2.

I've tried to follow any "best performance" advice when I could find it in each library's docs, but it's a certainty that some stones were left unturned when implementing ~20 different search engines.

The task:

1. Given a diverse list of 162,000 words and phrases, assume a Latin/Western European charset (can skip any diacritics/accents normalization)
2. Do a case-insensitive, partial/fuzzy match of the search string "super ma"
3. Sort the results in the most sensible way, following the [Principle of least astonishment](https://en.wikipedia.org/wiki/Principle_of_least_astonishment)
4. Optionally highlight the matched substrings in each result
5. Bonus points for matches with out-of-order terms
6. Do it with the fewest resources (CPU and RAM)

<!--
https://bestofjs.org/projects?tags=search
-->

<table>
    <thead>
        <tr>
            <th>Lib</th>
            <th>Stars</th>
            <th>Size (min)</th>
            <th>Init</th>
            <th>Search</th>
            <th>Heap (peak)</th>
            <th>Retained</th>
        </tr>
    </thead>
    <tbody>
        <tr>
            <td>
                <a href="https://github.com/leeoniya/uFuzzy">uFuzzy</a>
                (<a href="https://leeoniya.github.io/uFuzzy/demos/compare.html?libs=uFuzzy&search=super%20ma">try</a>)
            </td>
            <td>★ 0</td>
            <td>2.5KB</td>
            <td>0.3ms</td>
            <td>11.7ms</td>
            <td>7.7MB</td>
            <td>7.5MB</td>
        </tr>
        <tr>
            <td>
                <a href="https://github.com/krisk/Fuse">Fuse.js</a>
                (<a href="https://leeoniya.github.io/uFuzzy/demos/compare.html?libs=Fuse&search=super%20ma">try</a>)
            </td>
            <td>★ 14.8k</td>
            <td>23.5KB</td>
            <td>34ms</td>
            <td>600ms</td>
            <td>20.6MB</td>
            <td>14.2MB</td>
        </tr>
        <tr>
            <td>
                <a href="https://github.com/nextapps-de/flexsearch">FlexSearch (Light)</a>
                (<a href="https://leeoniya.github.io/uFuzzy/demos/compare.html?libs=FlexSearch&search=super%20ma">try</a>)
            </td>
            <td>★ 8.9k</td>
            <td>5.9KB</td>
            <td>3500ms</td>
            <td>8.1ms</td>
            <td>322MB</td>
            <td>323MB</td>
        </tr>
        <tr>
            <td>
                <a href="https://github.com/olivernn/lunr.js">Lunr.js</a>
                (<a href="https://leeoniya.github.io/uFuzzy/demos/compare.html?libs=Lunr&search=super~1%20ma~1">try</a>)
            </td>
            <td>★ 8.2k</td>
            <td>29.4KB</td>
            <td>1700ms</td>
            <td>8.7ms</td>
            <td>128MB</td>
            <td>127MB</td>
        </tr>
        <tr>
            <td>
                <a href="https://github.com/LyraSearch/lyra">LyraSearch</a>
                (<a href="https://leeoniya.github.io/uFuzzy/demos/compare.html?libs=LyraSearch&search=super%20ma">try</a>)
            </td>
            <td>★ 3.3k</td>
        </tr>
        <tr>
            <td>
                <a href="https://github.com/kentcdodds/match-sorter">match-sorter</a>
                (<a href="https://leeoniya.github.io/uFuzzy/demos/compare.html?libs=match-sorter&search=super%20ma">try</a>)
            </td>
            <td>★ 3.1k</td>
            <td>7.3KB</td>
            <td>0.03ms</td>
            <td>125ms</td>
            <td>13.1MB</td>
            <td>12.9MB</td>
        </tr>
        <tr>
            <td>
                <a href="https://github.com/farzher/fuzzysort">fuzzysort</a>
                (<a href="https://leeoniya.github.io/uFuzzy/demos/compare.html?libs=fuzzysort&search=super%20ma">try</a>)
            </td>
            <td>★ 3k</td>
            <td>5.5KB</td>
            <td>50ms</td>
            <td>12ms</td>
            <td>54.7MB</td>
            <td>54.4MB</td>
        </tr>
        <tr>
            <td>
                <a href="https://github.com/bevacqua/fuzzysearch">fuzzysearch</a>
                (<a href="https://leeoniya.github.io/uFuzzy/demos/compare.html?libs=fuzzysearch&search=super%20ma">try</a>)
            </td>
            <td>★ 2.6k</td>
        </tr>
        <tr>
            <td>
                <a href="https://github.com/weixsong/elasticlunr.js">Elasticlunr.js</a>
                (<a href="https://leeoniya.github.io/uFuzzy/demos/compare.html?libs=Elasticlunr&search=super%20ma">try</a>)
            </td>
            <td>★ 1.9k</td>
            <td>18.1KB</td>
            <td>1000ms</td>
            <td>1.5ms</td>
            <td>73.6MB</td>
            <td>73.4MB</td>
        </tr>
        <tr>
            <td>
                <a href="https://github.com/lucaong/minisearch">MiniSearch</a>
                (<a href="https://leeoniya.github.io/uFuzzy/demos/compare.html?libs=MiniSearch&search=super%20ma">try</a>)
            </td>
            <td>★ 1.5k</td>
            <td>22.4KB</td>
            <td>575ms</td>
            <td>1ms</td>
            <td>70.2MB</td>
            <td>70MB</td>
        </tr>
        <tr>
            <td>
                <a href="https://github.com/Glench/fuzzyset.js">Fuzzyset</a>
                (<a href="https://leeoniya.github.io/uFuzzy/demos/compare.html?libs=Fuzzyset&search=super%20ma">try</a>)
            </td>
            <td>★ 1.3k</td>
            <td>2.8KB</td>
            <td>2900ms</td>
            <td>31ms</td>
            <td>246MB</td>
            <td>244MB</td>
        </tr>
        <tr>
            <td>
                <a href="https://github.com/fergiemcdowall/search-index">search-index</a>
                (<a href="https://leeoniya.github.io/uFuzzy/demos/compare.html?libs=search-index&search=super%20ma">try</a>)
            </td>
            <td>★ 1.3k</td>
        </tr>
        <tr>
            <td>
                <a href="https://github.com/rmm5t/liquidmetal">LiquidMetal</a>
                (<a href="https://leeoniya.github.io/uFuzzy/demos/compare.html?libs=LiquidMetal&search=super%20ma">try</a>)
            </td>
            <td>★ 285</td>
        </tr>
        <tr>
            <td>
                <a href="https://github.com/itemsapi/itemsjs">ItemJS</a>
                (<a href="https://leeoniya.github.io/uFuzzy/demos/compare.html?libs=ItemJS&search=super%20ma">try</a>)
            </td>
            <td>★ 260</td>
        </tr>
        <tr>
            <td>
                <a href="https://github.com/wouter2203/fuzzy-search">FuzzySearch</a>
                (<a href="https://leeoniya.github.io/uFuzzy/demos/compare.html?libs=fuzzy-search&search=super%20ma">try</a>)
            </td>
            <td>★ 184</td>
        </tr>
        <tr>
            <td>
                <a href="https://github.com/jeancroy/FuzzySearch">FuzzySearch2</a>
                (<a href="https://leeoniya.github.io/uFuzzy/demos/compare.html?libs=FuzzySearch2&search=super%20ma">try</a>)
            </td>
            <td>★ 173</td>
        </tr>
        <tr>
            <td>
                <a href="https://github.com/fwextensions/quick-score">QuickScore</a>
                (<a href="https://leeoniya.github.io/uFuzzy/demos/compare.html?libs=QuickScore&search=super%20ma">try</a>)
            </td>
            <td>★ 131</td>
            <td>9.1KB</td>
            <td>26ms</td>
            <td>155ms</td>
            <td>26.1MB</td>
            <td>18.7MB</td>
        </tr>
        <tr>
            <td>
                <a href="https://github.com/jhawthorn/fzy.js/">fzy</a>
                (<a href="https://leeoniya.github.io/uFuzzy/demos/compare.html?libs=fzy&search=super%20ma">try</a>)
            </td>
            <td>★ 115</td>
        </tr>
        <tr>
            <td>
                <a href="https://github.com/grafana/grafana/blob/main/packages/grafana-ui/src/utils/fuzzy.ts">fuzzyMatch</a>
                (<a href="https://leeoniya.github.io/uFuzzy/demos/compare.html?libs=fuzzyMatch&search=super%20ma">try</a>)
            </td>
            <td>★ 0</td>
        </tr>
    </tbody>
</table>