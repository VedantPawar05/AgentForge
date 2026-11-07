const fs = require('fs');

const f1 = fs.readFileSync('C:/Users/vedant/OneDrive/Desktop/AgentForge/Agent forge UI/unpacked/01_Dashboard_rendered.html', 'utf8');

const mainMatch = f1.match(/<main[\s\S]*?<\/main>/i);
if (mainMatch) {
  // Let's print sections in main
  const text = mainMatch[0];
  console.log('Main total length:', text.length);
  // print chunks
  for (let i = 0; i < text.length; i += 2000) {
    console.log(`\n--- CHUNK ${i} ---`);
    console.log(text.slice(i, i + 1000));
  }
}

