const fs = require('fs');
const path = require('path');

const files = fs.readdirSync('C:/Users/vedant/OneDrive/Desktop/AgentForge/Agent forge UI/unpacked')
  .filter(f => f.endsWith('_rendered.html'));

files.forEach(f => {
  const content = fs.readFileSync(path.join('C:/Users/vedant/OneDrive/Desktop/AgentForge/Agent forge UI/unpacked', f), 'utf8');
  const buttons = [...content.matchAll(/<button[^>]*>([\s\S]*?)<\/button>/gi)].map(m => m[1].replace(/<[^>]+>/g, '').trim()).filter(Boolean);
  const aBtns = [...content.matchAll(/<a[^>]*class="[^"]*btn[^"]*"[^>]*>([\s\S]*?)<\/a>/gi)].map(m => m[1].replace(/<[^>]+>/g, '').trim()).filter(Boolean);
  console.log(`\n=== ${f} ===`);
  console.log('Buttons:', [...new Set([...buttons, ...aBtns])]);
});

