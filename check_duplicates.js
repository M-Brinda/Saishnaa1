const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'js', 'journal-data.js');
const content = fs.readFileSync(filePath, 'utf8');

// Use regex to count occurrences of "IJECE": { or "IJECE":
const matches = content.match(/\"IJECE\"\s*\:/g);
console.log('Occurrences of "IJECE":', matches ? matches.length : 0);

// Let's print the line numbers of all matches
const lines = content.split('\n');
lines.forEach((line, idx) => {
  if (line.includes('"IJECE":') || line.includes('"IJECE" :')) {
    console.log(`Line ${idx + 1}: ${line.trim()}`);
  }
});
