const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'js', 'journal-data.js');
let content = fs.readFileSync(filePath, 'utf8');

// Replace all issn keys inside the journal data object
content = content.replace(/\"issn\":\s*\"[^\"]*\"/g, '"issn": "Waiting For Approved"');

// Replace all editorInChief name keys
content = content.replace(/(\"editorInChief\":\s*\{\s*\"name\":\s*\")[^\"]*\"/g, '$1Dr.P.Sivakumar"');

fs.writeFileSync(filePath, content, 'utf8');
console.log('Successfully updated journal-data.js!');
