const fs = require('fs');

const f5 = fs.readFileSync('C:/Users/vedant/OneDrive/Desktop/AgentForge/Agent forge UI/unpacked/05_Worktree_Sandbox_rendered.html', 'utf8');

const matches = [...f5.matchAll(/<(?:button|a|input|select|div\s+class="[^"]*(?:btn|button|chip|card|tab|badge)[^"]*")[^>]*>([\s\S]*?)<\/(?:button|a|input|select|div)>/gi)]
  .map(m => m[0].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim())
  .filter(s => s.length > 0 && s.length < 80);

console.log('Worktree Sandbox buttons & items:');
console.log([...new Set(matches)]);

