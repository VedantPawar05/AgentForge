const fs = require('fs');

const f1 = fs.readFileSync('C:/Users/vedant/OneDrive/Desktop/AgentForge/Agent forge UI/unpacked/01_Dashboard_rendered.html', 'utf8');

const mainMatch = f1.match(/<main[\s\S]*?<\/main>/i);
if (mainMatch) {
  console.log('Main snippet in Dashboard:');
  console.log(mainMatch[0].slice(0, 1500));
}

