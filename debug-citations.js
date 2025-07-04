// Quick debug script to understand the citation parsing issue
const text = 'This is a response with citation 【source:test.pdf】 and another 【source:guide.pdf】.';
const annotations = [
  {
    type: 'file_citation',
    text: '【source:test.pdf】',
    start_index: 34,
    end_index: 54,
    file_citation: {
      file_id: 'file-1',
      quote: 'Test quote from document',
    },
  },
  {
    type: 'file_citation',
    text: '【source:guide.pdf】',
    start_index: 67,
    end_index: 88,
    file_citation: {
      file_id: 'file-2',
      quote: 'Guide quote from document',
    },
  },
];

console.log('Original text:', text);
console.log('Text length:', text.length);
// Find the correct indices
const firstCitationStart = text.indexOf('【source:test.pdf】');
const firstCitationEnd = firstCitationStart + '【source:test.pdf】'.length;
const secondCitationStart = text.indexOf('【source:guide.pdf】');
const secondCitationEnd = secondCitationStart + '【source:guide.pdf】'.length;

console.log('First citation indices:', firstCitationStart, 'to', firstCitationEnd);
console.log('Second citation indices:', secondCitationStart, 'to', secondCitationEnd);
console.log('First citation text:', text.slice(firstCitationStart, firstCitationEnd));
console.log('Second citation text:', text.slice(secondCitationStart, secondCitationEnd));

// Check the actual characters at those positions
console.log('Characters around first citation:');
console.log(text.slice(30, 60));
console.log('Characters around second citation:');
console.log(text.slice(63, 92));