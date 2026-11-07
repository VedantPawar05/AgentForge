const fs = require('fs');
const lines = fs.readFileSync('apps/web/src/app/dashboard/page.tsx', 'utf8').split('\n');

for (let i = 1470; i < 1500; i++) {
  console.log((i + 1) + ': ' + lines[i]);
}

