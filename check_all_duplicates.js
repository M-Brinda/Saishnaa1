const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'js', 'journal-data.js');
const content = fs.readFileSync(filePath, 'utf8');

const lines = content.split('\n');
const keys = {};

lines.forEach((line, idx) => {
  // Match top-level keys like "IJCSE": { or "IJCSE" : {
  const match = line.match(/^\s*\"([A-Z]+)\"\s*\:\s*\{/);
  if (match) {
    const key = match[1];
    if (!keys[key]) {
      keys[key] = [];
    }
    keys[key].push(idx + 1);
  }
});

console.log('--- Key Occurrences ---');
for (const [key, linesList] of Object.entries(keys)) {
  if (linesList.length > 1) {
    console.log(`Duplicate Key "${key}" found at lines: ${linesList.join(', ')}`);
  } else {
    console.log(`Key "${key}" found at line: ${linesList[0]}`);
  }
}
