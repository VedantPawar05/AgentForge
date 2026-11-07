const fs = require('fs');
const path = require('path');

const pageOrder = [
  { id: "9fd042de-114f-4410-af79-ed994a27f9ec", name: "01_Dashboard" },
  { id: "50d36e45-56f3-449b-9c46-a9644aa332b7", name: "02_CLI_Studio" },
  { id: "6cbaf353-5680-4a6d-ac92-5acc7c4964ca", name: "03_Tasks" },
  { id: "24a15184-2687-4c83-9525-0dfa125cd50b", name: "04_Code_Review" },
  { id: "23b4587f-5447-4043-a9bb-eb7fa3786439", name: "05_Worktree_Sandbox" },
  { id: "9390f7bd-2ec5-4718-95c8-7b3aa7ac54c0", name: "06_Providers" },
  { id: "31643be1-ad21-4364-8ef5-67bc4332b8c4", name: "07_New_Task" },
  { id: "62ae8b43-f13a-4202-813b-530ba8c09995", name: "08_Split_View" }
];

const inDir = 'C:/Users/vedant/OneDrive/Desktop/AgentForge/Agent forge UI/unpacked';

pageOrder.forEach(p => {
  const filePath = path.join(inDir, `${p.id}.html`);
  const content = fs.readFileSync(filePath, 'utf8');
  const tmplMatch = content.match(/<script type="__bundler\/template">([\s\S]*?)<\/script>/);
  if (tmplMatch) {
    try {
      const tmpl = JSON.parse(tmplMatch[1]);
      console.log(`\n=================== ${p.name} template length: ${tmpl.length} ===================`);
      fs.writeFileSync(`C:/Users/vedant/OneDrive/Desktop/AgentForge/Agent forge UI/unpacked/${p.name}_rendered.html`, tmpl);
      
      // Look for buttons, titles, forms, inputs in tmpl
      const buttons = [...tmpl.matchAll(/<button[^>]*>([\s\S]*?)<\/button>/gi)].map(m => m[1].replace(/<[^>]+>/g, '').trim()).filter(Boolean);
      console.log('Buttons:', [...new Set(buttons)]);
      
      // Look for elements with text or aria-label
      const texts = [...tmpl.matchAll(/>([^<]{3,80})</g)].map(m => m[1].trim()).filter(s => s && !s.startsWith('{') && !s.includes(';') && !s.includes('='));
      console.log('Sample texts:', [...new Set(texts)].slice(0, 30));
    } catch(e) {
      console.log('err parsing template in', p.name, e.message);
    }
  } else {
    console.log('No template in', p.name);
  }
});

