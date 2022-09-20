## ▒ μFuzzy

A tiny, efficient, fuzzy search that doesn't suck

---
### Introduction

This is my fuzzy 🐈. [There are many like it](#), but this one is mine.

uFuzzy is a fuzzy search lib designed to match a relatively short search string (needle) against a large list of short-to-medium strings (haystack).
It might be best described as a more forgiving [String.prototype.indexOf()](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String/indexOf).

Common use cases are list filtering, auto-complete/suggest, title/name or description search, filenames or functions.
uFuzzy is case insensitive and expects all alpha-numeric characters in the needle to occur in the same order, with an adjustable tolerance for additionally inserted characters;
`horse cart` will not match `cart horse`, but would be matched for either `cart` or `horse`.
This disqualifies uFuzzy from being used as a spellcheck (due to omitted letters), or a fulltext/document search, where terms can be out of order.
However, it's easy to perform a separate uFuzzy search for each permutation of terms in the needle to achieve out-of-order matching without appreciable degredation in performance for most cases.

Now that you know what uFuzzy _isn't_, let's see what it can offer over existing solutions.

---
### Demo

Below are some comparisons using a diverse 162,000 string/phrase dataset derived mostly from concatenating the lists from [fuzzysort's demo](https://rawgit.com/farzher/fuzzysort/master/test.html), plus 9,000 metrics objects split into three lists (`metric_type_9000`, `metric_name_9000`, `metric_help_9000`):

```
[
  {
    "type": "gauge",
    "name": "coordinator_prometheus_engine_prometheus_engine_queries",
    "help": "The current number of queries being executed or waiting.",
  },
  ...
]
```

First, here is uFuzzy in isolation to demonstrate its performance:

https://leeoniya.github.io/uFuzzy/demos/compare.html?libs=uFuzzy&search=super%20ma

Now the same comparison page, booted with [fuzzysort](https://github.com/farzher/fuzzysort), [QuickScore](https://fwextensions.github.io/quick-score-demo/), and [Fuse.js](https://fusejs.io/):

https://leeoniya.github.io/uFuzzy/demos/compare.html?libs=uFuzzy,fuzzysort,QuickScore,Fuse&search=super%20ma

Here is the full library list but with a reduced dataset (just `hearthstone_750`, `urls_and_titles_600`) to avoid crashing your browser:

https://leeoniya.github.io/uFuzzy/demos/compare.html?lists=hearthstone_750,urls_and_titles_600&search=moo

---
### Similar work

FuzzySearch
fuzzylist
fuzzymatch
fuzzysort
match-sorter
quickscore
Fuse.js
FlexSeach
LyraSearch


---
### FAQ

searching objects
serching multiple properties