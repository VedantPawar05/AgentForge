const fs = require('fs');

const f8 = fs.readFileSync('C:/Users/vedant/OneDrive/Desktop/AgentForge/Agent forge UI/unpacked/08_Split_View_rendered.html', 'utf8');

// Find the code snippets inside the panes
const codeBlocks = [...f8.matchAll(/<pre[^>]*>([\s\S]*?)<\/pre>/gi)].map(m => m[1]);
console.log('Pre code blocks count:', codeBlocks.length);
codeBlocks.forEach((c, idx) => {
  console.log(`\n--- Code block ${idx + 1} (length: ${c.length}) ---`);
  console.log(c.replace(/<[^>]+>/g, '').slice(0, 400));
});

