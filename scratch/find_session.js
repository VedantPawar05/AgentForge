const fs = require('fs');

const f8 = fs.readFileSync('C:/Users/vedant/OneDrive/Desktop/AgentForge/Agent forge UI/unpacked/08_Split_View_rendered.html', 'utf8');

const idx = f8.indexOf('session.ts');
if (idx !== -1) {
  console.log('Snippet around session.ts:');
  console.log(f8.slice(idx - 100, idx + 1200));
}

