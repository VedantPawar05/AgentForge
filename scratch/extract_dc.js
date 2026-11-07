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
const outDir = 'C:/Users/vedant/OneDrive/Desktop/AgentForge/Agent forge UI/screens_code';
if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

pageOrder.forEach(p => {
  const filePath = path.join(inDir, `${p.id}.html`);
  if (!fs.existsSync(filePath)) return;
  const content = fs.readFileSync(filePath, 'utf8');
  
  const dcMatch = content.match(/<script type="text\/x-dc"[^>]*>([\s\S]*?)<\/script>/i);
  if (dcMatch) {
    const code = dcMatch[1].trim();
    const dest = path.join(outDir, `${p.name}.tsx`);
    fs.writeFileSync(dest, code);
    console.log(`Extracted ${p.name}.tsx (${code.length} chars)`);
  } else {
    console.log(`No dc script in ${p.name}`);
  }
});

