const fs = require('fs');

const f8 = fs.readFileSync('C:/Users/vedant/OneDrive/Desktop/AgentForge/Agent forge UI/unpacked/08_Split_View_rendered.html', 'utf8');

// Print main sections, buttons, and interaction elements
console.log('--- 08 Split View length:', f8.length);
// Extract headings and interactive elements
const matches = [...f8.matchAll(/<(?:button|a|input|select|div\s+class="[^"]*(?:btn|button|chip|card|tab|badge)[^"]*")[^>]*>([\s\S]*?)<\/(?:button|a|input|select|div)>/gi)]
  .map(m => m[0].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim())
  .filter(s => s.length > 0 && s.length < 80);

console.log('Interactive items in Split View:');
console.log([...new Set(matches)].slice(0, 30));

