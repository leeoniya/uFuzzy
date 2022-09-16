## ▒ μFuzzy

A tiny, efficient, fuzzy search that doesn't suck

---
### Introduction

This is my fuzzy 🐈. [There are many like it](#), but this one is mine.

uFuzzy is a fuzzy matching lib designed to match a relatively short search string (needle) against a large list of short-to-medium strings (haystack).
It might be best described as a more forgiving [String.prototype.indexOf()](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String/indexOf).
Common use cases are list filtering, auto-complete/suggest, title/name or description search, filenames or functions.
uFuzzy is case insensitive and requires that all alpha-numeric characters in the needle occur in the match, with and adjustable tolerance for additionally inserted characters.
As a consequence, terms can only be matched in supplied order; `horse cart` will not match `cart horse`, but would be matched for either `cart` or `horse`.
This disqualifies uFuzzy from being used as a spellcheck (since missing letters can occur), or a fulltext or document/object search, where terms can be out of order.

Now that you know what uFuzzy _isn't_, let's see what it can offer over existing solutions.