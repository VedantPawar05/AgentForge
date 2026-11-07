const fs = require('fs');

const content = fs.readFileSync('C:/Users/vedant/OneDrive/Desktop/AgentForge/Agent forge UI/AgentForge UI.html', 'utf8');

const templateMatch = content.match(/<script type="__bundler\/template">([\s\S]*?)<\/script>/);
if (templateMatch) {
  console.log('Template length:', templateMatch[1].length);
  console.log('Template snippet:\n', templateMatch[1].slice(0, 1000));
}

// Let's also check ext_resources
const extMatch = content.match(/<script type="__bundler\/ext_resources">([\s\S]*?)<\/script>/);
if (extMatch) {
  console.log('ext_resources:', extMatch[1]);
}

