const fs = require('fs');
const lines = fs.readFileSync('apps/web/src/app/dashboard/page.tsx', 'utf8').split('\n');
console.log('Total lines:', lines.length);
for (let i = lines.length - 40; i < lines.length; i++) {
  console.log((i + 1) + ': ' + lines[i]);
}

