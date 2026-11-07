const fs = require('fs');

let page = fs.readFileSync('apps/web/src/app/dashboard/page.tsx', 'utf8');

// Backup current page
fs.writeFileSync('apps/web/src/app/dashboard/page.tsx.bak2', page, 'utf8');
console.log('Created backup: apps/web/src/app/dashboard/page.tsx.bak2');

