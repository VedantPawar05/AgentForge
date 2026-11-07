const fs = require('fs');

const f8 = fs.readFileSync('C:/Users/vedant/OneDrive/Desktop/AgentForge/Agent forge UI/unpacked/08_Split_View_rendered.html', 'utf8');

// Print the main container HTML (inside body or main)
const mainMatch = f8.match(/<main[\s\S]*?<\/main>/i) || f8.match(/<div class="app"[\s\S]*?<\/div>\s*<\/div>/i);
if (mainMatch) {
  console.log('Main snippet in Split View:');
  console.log(mainMatch[0].slice(0, 1500));
} else {
  console.log('No main, checking body snippet:');
  console.log(f8.slice(f8.indexOf('<body'), f8.indexOf('<body') + 2000));
}

