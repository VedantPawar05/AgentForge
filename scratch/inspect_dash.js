const fs = require('fs');

const f1 = fs.readFileSync('C:/Users/vedant/OneDrive/Desktop/AgentForge/Agent forge UI/unpacked/01_Dashboard_rendered.html', 'utf8');

const matches = [...f1.matchAll(/<(?:button|a|input|select|div\s+class="[^"]*(?:btn|button|chip|card|tab|badge)[^"]*")[^>]*>([\s\S]*?)<\/(?:button|a|input|select|div)>/gi)]
  .map(m => m[0].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim())
  .filter(s => s.length > 0 && s.length < 80);

console.log('Dashboard items:');
console.log([...new Set(matches)]);

