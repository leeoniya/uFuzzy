class TrieNode {
    constructor() {
        this.children = {};
        this.isEndOfWord = false;
        this.metaData = {};
    }
}

class Trie {
    constructor() {
        this.root = new TrieNode();
    }

    /**
    * Add a word to the Trie
    * @param {String} word
    * @param {Object} [metaData] - attach additional data to the word
    * @param {TrieNode} [node]
    * @param {Boolean} [allowEmptyWords] - empty word doesn't have any char, you shouldn't pass a true value for it because we are disallowing adding an empty word
    */
    add(word, metaData = {}, node = this.root, allowEmptyWords = false) {
        const newWord = word.toLowerCase();
        const newNode = node;
        if (newWord.length === 0 && !allowEmptyWords) {
            throw new Error('Cannot insert empty word into Trie');
        }
        if (newWord.length === 0) {
            newNode.isEndOfWord = true;
            newNode.metaData = metaData;
            return;
        }
        if (!newNode.children[newWord[0]]) {
            newNode.children[newWord[0]] = new TrieNode();
            this.add(newWord.substring(1), metaData, newNode.children[newWord[0]], true);
        }
        this.add(newWord.substring(1), metaData, newNode.children[newWord[0]], true);
    }

    /**
    * Search for a word in the Trie.
    * @param {String} word
    * @returns {Object|null} – the node for the word if it's found, or null if it's not found
    */
    search(word) {
        let newWord = word.toLowerCase();
        let node = this.root;
        while (newWord.length > 1) {
            if (!node.children[newWord[0]]) {
                return null;
            }
            node = node.children[newWord[0]];

            newWord = newWord.substring(1);
        }
        return node.children[newWord] && node.children[newWord].isEndOfWord ? node.children[newWord] : null;
    }

    /**
    * Update a word data in the Trie.
    * @param {String} word
    * @param {Object} metaData
    */
    update(word, metaData) {
        let newWord = word.toLowerCase();
        let node = this.root;
        while (newWord.length > 1) {
            if (!node.children[newWord[0]]) {
                throw new Error('Word does not exist in the Trie');
            }
            node = node.children[newWord[0]];
            newWord = newWord.substring(1);
        }
        node.children[newWord].metaData = metaData;
    }

    /**
    * Find all leaf nodes starting with a substring.
    * @param {String} substr
    * @param {Number} [limit] - matching words limit
    * @returns {Array}
    */
    getAllMatchingWords(substr, limit = 5) {
        const newSubstr = substr.toLowerCase();
        let node = this.root;
        let prefix = '';
        for (let i = 0; i < newSubstr.length; i++) {
            prefix += newSubstr[i];
            if (!node.children[newSubstr[i]]) {
                return [];
            }
            node = node.children[newSubstr[i]];
        }
        return this.getChildMatching(node, prefix, limit, []);
    }

    /**
    * Find all leaf nodes that are descendants of a given child node.
    * @param {TrieNode} node
    * @param {String} prefix
    * @param {Number} limit
    * @param {Array} [words]
    * @returns {Array}
    */
    getChildMatching(node, prefix, limit, words = []) {
        const matching = words;
        if (matching.length >= limit) {
            return matching;
        }
        if (node.isEndOfWord) {
            matching.unshift({ name: prefix, metaData: node.metaData });
        }
        const children = Object.keys(node.children);
        for (let i = 0; i < children.length; i++) {
            this.getChildMatching(node.children[children[i]], prefix + children[i], limit, matching);
        }
        return matching;
    }
}

function initEmojisTrie(emojis) {
    const emojisTrie = new Trie();

    // Inserting all emojis into the Trie object
    for (let i = 0; i < emojis.length; i++) {
        if (emojis[i].name) {
            const node = emojisTrie.search(emojis[i].name);
            if (!node) {
                emojisTrie.add(emojis[i].name, { code: emojis[i].code, suggestions: [] });
            } else {
                emojisTrie.update(emojis[i].name, { code: emojis[i].code, suggestions: node.metaData.suggestions });
            }

            if (emojis[i].keywords) {
                for (let j = 0; j < emojis[i].keywords.length; j++) {
                    const keywordNode = emojisTrie.search(emojis[i].keywords[j]);
                    if (!keywordNode) {
                        emojisTrie.add(emojis[i].keywords[j], { suggestions: [{ code: emojis[i].code, name: emojis[i].name }] });
                    } else {
                        emojisTrie.update(emojis[i].keywords[j],
                            { ...keywordNode.metaData, suggestions: [...keywordNode.metaData.suggestions, { code: emojis[i].code, name: emojis[i].name }] });
                    }
                }
            }
        }
    }

    return emojisTrie;
}