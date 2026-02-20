import fs from 'fs';
import { globSync } from 'glob';

const files = globSync('src/**/*.tsx');

files.forEach(file => {
  let content = fs.readFileSync(file, 'utf8');
  let newContent = content.replace(/<Alert([^>]*?)title=(['"{])/g, '<Alert$1message=$2');
  if (content !== newContent) {
    fs.writeFileSync(file, newContent, 'utf8');
    console.log(`Updated ${file}`);
  }
});
