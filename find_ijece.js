const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'js', 'journal-data.js');
const content = fs.readFileSync(filePath, 'utf8');

let pos = -1;
while ((pos = content.indexOf('"IJECE"', pos + 1)) !== -1) {
  const lineNum = content.substring(0, pos).split('\n').length;
  console.log(`Found "IJECE" at line ${lineNum}: ${content.substring(pos, pos + 40).replace(/\n/g, ' ')}`);
}
