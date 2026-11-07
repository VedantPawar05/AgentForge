const fs = require('fs');
const path = require('path');

const pageOrder = [
  { id: "9fd042de-114f-4410-af79-ed994a27f9ec", name: "Dashboard" },
  { id: "50d36e45-56f3-449b-9c46-a9644aa332b7", name: "CLI Studio" },
  { id: "6cbaf353-5680-4a6d-ac92-5acc7c4964ca", name: "Tasks" },
  { id: "24a15184-2687-4c83-9525-0dfa125cd50b", name: "Code Review" },
  { id: "23b4587f-5447-4043-a9bb-eb7fa3786439", name: "Worktree Sandbox" },
  { id: "9390f7bd-2ec5-4718-95c8-7b3aa7ac54c0", name: "Providers" },
  { id: "31643be1-ad21-4364-8ef5-67bc4332b8c4", name: "New Task" },
  { id: "62ae8b43-f13a-4202-813b-530ba8c09995", name: "Split View" }
];

const outDir = 'C:/Users/vedant/OneDrive/Desktop/AgentForge/Agent forge UI/unpacked';

pageOrder.forEach((pInfo) => {
  const p = path.join(outDir, `${pInfo.id}.html`);
  const html = fs.readFileSync(p, 'utf8');
  console.log(`\n=================== ${pInfo.name} (${html.length} chars) ===================`);
  // Look for text in body
  // Strip tags, get words
  const bodyMatch = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
  if (bodyMatch) {
    const raw = bodyMatch[1]
      .replace(/<style[\s\S]*?<\/style>/gi, '')
      .replace(/<script[\s\S]*?<\/script>/gi, '')
      .replace(/<svg[\s\S]*?<\/svg>/gi, ' [SVG] ')
      .replace(/<[^>]+>/g, '\n')
      .split('\n')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('{') && !s.startsWith('.'));
    
    // Deduplicate consecutive lines
    const dedup = [];
    raw.forEach(r => {
      if (dedup[dedup.length - 1] !== r) dedup.push(r);
    });
    console.log('Sample content:\n' + dedup.slice(0, 45).join('\n'));
  }
});

