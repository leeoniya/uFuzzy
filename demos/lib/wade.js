/**
 * Wade v0.3.3
 * Copyright 2017-2018 Kabir Shah
 * Released under the MIT License
 * https://github.com/kbrsh/wade
 */

(function(root, factory) {
  /* ======= Global Wade ======= */
  if(typeof module === "undefined") {
    root.Wade = factory();
  } else {
    module.exports = factory();
  }
}(this, function() {
    var whitespaceRE = /\s+/g;

    var config = {
      stopWords: ["about", "after", "all", "also", "am", "an", "and", "another", "any", "are", "as", "at", "be", "because", "been", "before", "being", "between", "both", "but", "by", "came", "can", "come", "could", "did", "do", "each", "for", "from", "get", "got", "has", "had", "he", "have", "her", "here", "him", "himself", "his", "how", "if", "in", "into", "is", "it", "like", "make", "many", "me", "might", "more", "most", "much", "must", "my", "never", "now", "of", "on", "only", "or", "other", "our", "out", "over", "said", "same", "see", "should", "since", "some", "still", "such", "take", "than", "that", "the", "their", "them", "then", "there", "these", "they", "this", "those", "through", "to", "too", "under", "up", "very", "was", "way", "we", "well", "were", "what", "where", "which", "while", "who", "with", "would", "you", "your", "a", "i"],
      punctuationRE: /[@!"',.:;?()[\]]/g,
      processors: [
        function(entry) {
          return entry.toLowerCase();
        },
        function(entry) {
          return entry.replace(config.punctuationRE, '');
        },
        function(entry) {
          var stopWords = config.stopWords;
          var terms = getTerms(entry);
          var i = terms.length;

          while((i--) !== 0) {
            if(stopWords.indexOf(terms[i]) !== -1) {
              terms.splice(i, 1);
            }
          }

          return terms.join(' ');
        }
      ]
    };

    var stringify = function(arr) {
      var output = '[';
      var separator = '';
      var empty = 0;

      for(var i = 0; i < arr.length; i++) {
        var element = arr[i];

        if(element === undefined) {
          empty++;
        } else {
          if(typeof element !== "number") {
            element = stringify(element);
          }

          if(empty > 0) {
            output += separator + '@' + empty;
            empty = 0;
            separator = ',';
          }

          output += separator + element;
          separator = ',';
        }
      }

      return output + ']';
    }

    var parse = function(str) {
      var arr = [];
      var stack = [arr];
      var currentIndex = 1;

      while(stack.length !== 0) {
        var currentArr = stack[stack.length - 1];
        var element = '';

        for(; currentIndex < str.length; currentIndex++) {
          var char = str[currentIndex];
          if(char === ',') {
            if(element.length !== 0) {
              if(element[0] === '@') {
                var elementInt = parseInt(element.substring(1));
                for(var i = 0; i < elementInt; i++) {
                  currentArr.push(undefined);
                }
              } else {
                currentArr.push(parseFloat(element));
              }
              element = '';
            }
          } else if(char === '[') {
            var childArr = [];
            currentArr.push(childArr);
            stack.push(childArr);
            currentIndex++;
            break;
          } else if(char === ']') {
            stack.pop();
            currentIndex++;
            break;
          } else {
            element += char;
          }
        }

        if(element.length !== 0) {
          currentArr.push(parseInt(element));
        }
      }

      return arr;
    }

    var getTerms = function(entry) {
      if (entry.length === 0) {
        return [];
      }

      var terms = entry.split(whitespaceRE);

      if(terms[0].length === 0) {
        terms.shift();
      }

      if(terms[terms.length - 1].length === 0) {
        terms.pop();
      }

      return terms;
    }

    var processEntry = function(entry) {
      if(entry.length === 0) {
        return entry;
      } else {
        var processors = config.processors;

        for(var i = 0; i < processors.length; i++) {
          entry = processors[i](entry);
        }

        return entry;
      }
    }

    var update = function(results, resultIndexes, increment, data) {
      var relevance = data[1];
      for(var i = 2; i < data.length; i++) {
        var index = data[i];
        var resultIndex = resultIndexes[index];
        if(resultIndex === undefined) {
          var lastIndex = results.length;
          resultIndexes[index] = lastIndex;
          results[lastIndex] = {
            index: index,
            score: relevance * increment
          };
        } else {
          results[resultIndex].score += relevance * increment;
        }
      }
    }

    var Wade = function(data) {
      var search = function(query) {
        var index = search.index;
        var processed = processEntry(query);
        var results = [];
        var resultIndexes = {};

        if(processed.length === 0) {
          return results;
        } else {
          var terms = getTerms(processed);
          var termsLength = terms.length;
          var exactTermsLength = termsLength - 1;
          var increment = 1 / termsLength;

          exactOuter: for(var i = 0; i < exactTermsLength; i++) {
            var term = terms[i];
            var termLength = term.length - 1;
            var node = index;

            for(var j = 0; j <= termLength; j++) {
              var termOffset = node[0][0];
              var termIndex = term.charCodeAt(j) + termOffset;

              if(termIndex < 1 || (termOffset === undefined && j === termLength) || node[termIndex] === undefined) {
                continue exactOuter;
              }

              node = node[termIndex];
            }

            var nodeData = node[0];
            if(nodeData.length !== 1) {
              update(results, resultIndexes, increment, nodeData);
            }
          }

          var lastTerm = terms[exactTermsLength];
          var lastTermLength = lastTerm.length - 1;
          var node$1 = index;

          for(var i$1 = 0; i$1 <= lastTermLength; i$1++) {
            var lastTermOffset = node$1[0][0];
            var lastTermIndex = lastTerm.charCodeAt(i$1) + lastTermOffset;

            if(lastTermIndex < 1 || (lastTermOffset === undefined && i$1 === lastTermLength) || node$1[lastTermIndex] === undefined) {
              break;
            }

            node$1 = node$1[lastTermIndex];
          }

          if(node$1 !== undefined) {
            var nodes = [node$1];
            for(var i$2 = 0; i$2 < nodes.length; i$2++) {
              var childNode = nodes[i$2];
              var childNodeData = childNode[0];

              if(childNodeData.length !== 1) {
                update(results, resultIndexes, increment, childNodeData);
              }

              for(var j$1 = 1; j$1 < childNode.length; j$1++) {
                var grandChildNode = childNode[j$1];
                if(grandChildNode !== undefined) {
                  nodes.push(grandChildNode);
                }
              }
            }
          }

          return results;
        }
      }

      if(Array.isArray(data)) {
        search.index = Wade.index(data);
      } else {
        search.index = parse(data);
      }

      return search;
    }

    Wade.index = function(data) {
      var dataLength = 0;
      var ranges = {};
      var processed = [];

      for(var i = 0; i < data.length; i++) {
        var entry = processEntry(data[i]);

        if(entry.length !== 0) {
          var terms = getTerms(entry);
          var termsLength = terms.length;

          for(var j = 0; j < termsLength; j++) {
            var term = terms[j];
            var processedTerm = [];
            var currentRanges = ranges;

            for(var n = 0; n < term.length; n++) {
              var char = term.charCodeAt(n);
              var highByte = char >>> 8;
              var lowByte = char & 0xFF;

              if(highByte !== 0) {
                if(currentRanges.minimum === undefined || highByte < currentRanges.minimum) {
                  currentRanges.minimum = highByte;
                }

                if(currentRanges.maximum === undefined || highByte > currentRanges.maximum) {
                  currentRanges.maximum = highByte;
                }

                var nextRanges = currentRanges[highByte];
                if(nextRanges === undefined) {
                  currentRanges = currentRanges[highByte] = {};
                } else {
                  currentRanges = nextRanges;
                }

                processedTerm.push(highByte);
              }

              if(currentRanges.minimum === undefined || lowByte < currentRanges.minimum) {
                currentRanges.minimum = lowByte;
              }

              if(currentRanges.maximum === undefined || lowByte > currentRanges.maximum) {
                currentRanges.maximum = lowByte;
              }

              var nextRanges$1 = currentRanges[lowByte];
              if(nextRanges$1 === undefined) {
                currentRanges = currentRanges[lowByte] = {};
              } else {
                currentRanges = nextRanges$1;
              }

              processedTerm.push(lowByte);
            }

            processed.push(i);
            processed.push(termsLength);
            processed.push(processedTerm);
          }
        }

        dataLength++;
      }

      var indexMinimum = ranges.minimum;
      var indexMaximum = ranges.maximum;
      var indexSize = 1;
      var indexOffset;

      if(indexMinimum !== undefined && indexMaximum !== undefined) {
        indexSize = indexMaximum - indexMinimum + 2;
        indexOffset = 1 - indexMinimum;
      }

      var nodeDataSets = [];
      var index = new Array(indexSize);
      index[0] = [indexOffset];

      for(var i$1 = 0; i$1 < processed.length; i$1 += 3) {
        var dataIndex = processed[i$1];
        var termsLength$1 = processed[i$1 + 1];
        var processedTerm$1 = processed[i$1 + 2];
        var processedTermLength = processedTerm$1.length - 1;
        var node = index;
        var termRanges = ranges;

        for(var j$1 = 0; j$1 < processedTermLength; j$1++) {
          var char$1 = processedTerm$1[j$1];
          var charIndex = char$1 + node[0][0];
          var termNode = node[charIndex];
          termRanges = termRanges[char$1];

          if(termNode === undefined) {
            var termMinimum = termRanges.minimum;
            var termMaximum = termRanges.maximum;
            termNode = node[charIndex] = new Array(termMaximum - termMinimum + 2);
            termNode[0] = [1 - termMinimum];
          }

          node = termNode;
        }

        var lastChar = processedTerm$1[processedTermLength];
        var lastCharIndex = lastChar + node[0][0]
        var lastTermNode = node[lastCharIndex];
        termRanges = termRanges[lastChar];

        if(lastTermNode === undefined) {
          var lastTermMinimum = termRanges.minimum;
          var lastTermMaximum = termRanges.maximum;
          var lastTermSize = 1;
          var lastTermOffset = (void 0);

          if(lastTermMinimum !== undefined && lastTermMaximum !== undefined) {
            lastTermSize = lastTermMaximum - lastTermMinimum + 2;
            lastTermOffset = 1 - lastTermMinimum;
          }

          lastTermNode = node[lastCharIndex] = new Array(lastTermSize);
          nodeDataSets.push(lastTermNode[0] = [lastTermOffset, 1 / termsLength$1, dataIndex]);
        } else {
          var nodeData = lastTermNode[0];

          if(nodeData.length === 1) {
            nodeData.push(1 / termsLength$1);
            nodeData.push(dataIndex);
            nodeDataSets.push(nodeData);
          } else {
            nodeData[1] += 1 / termsLength$1;
            nodeData.push(dataIndex);
          }
        }
      }

      for(var i$2 = 0; i$2 < nodeDataSets.length; i$2++) {
        var nodeData$1 = nodeDataSets[i$2];
        nodeData$1[1] = 1.5 - (nodeData$1[1] / dataLength);
      }

      return index;
    }

    Wade.save = function(search) {
      return stringify(search.index);
    }

    Wade.config = config;

    Wade.version = "0.3.3";

    return Wade;
}));
