const fs = require('fs');
const path = require('path');

const imgDir = path.join(__dirname, 'img');

const files = fs.readdirSync(imgDir);

files.forEach(file => {
  if (file.endsWith('_cover.svg')) {
    const filePath = path.join(imgDir, file);
    let content = fs.readFileSync(filePath, 'utf8');
    
    // Remove the text element containing VOLUME ... ISSUE
    const originalLength = content.length;
    content = content.replace(/<text[^>]*>(?:ISSN:[^<]+)?VOLUME\s*\d+\s*\|\s*ISSUE\s*\d+<\/text>\s*\n?/gi, '');
    
    if (content.length !== originalLength) {
      fs.writeFileSync(filePath, content, 'utf8');
      console.log(`Successfully updated ${file}`);
    } else {
      console.log(`No match in ${file}`);
    }
  }
});
