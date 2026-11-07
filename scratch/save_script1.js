const fs = require('fs');

const content = fs.readFileSync('C:/Users/vedant/OneDrive/Desktop/AgentForge/Agent forge UI/AgentForge UI.html', 'utf8');

const s1 = content.match(/<script>([\s\S]*?)<\/script>/);
if (s1) {
  console.log('Script 1 length:', s1[1].length);
  fs.writeFileSync('C:/Users/vedant/OneDrive/Desktop/AgentForge/scratch/script1.js', s1[1]);
  console.log('Saved scratch/script1.js');
}

