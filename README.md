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

https://leeoniya.github.io/uFuzzy/demos/compare.html?libs=uFuzzy,QuickScore,fuzzysort&search=super%20ma