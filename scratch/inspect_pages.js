const fs = require('fs');
const path = require('path');

const pageOrder = [
  "9fd042de-114f-4410-af79-ed994a27f9ec",
  "50d36e45-56f3-449b-9c46-a9644aa332b7",
  "6cbaf353-5680-4a6d-ac92-5acc7c4964ca",
  "24a15184-2687-4c83-9525-0dfa125cd50b",
  "23b4587f-5447-4043-a9bb-eb7fa3786439",
  "9390f7bd-2ec5-4718-95c8-7b3aa7ac54c0",
  "31643be1-ad21-4364-8ef5-67bc4332b8c4",
  "62ae8b43-f13a-4202-813b-530ba8c09995"
];

const outDir = 'C:/Users/vedant/OneDrive/Desktop/AgentForge/Agent forge UI/unpacked';

pageOrder.forEach((id, index) => {
  const p = path.join(outDir, `${id}.html`);
  if (!fs.existsSync(p)) return;
  const html = fs.readFileSync(p, 'utf8');
  
  // Extract title or main heading
  const title = (html.match(/<title>([^<]*)<\/title>/i) || [])[1] || '';
  const h1s = [...html.matchAll(/<h1[^>]*>([\s\S]*?)<\/h1>/gi)].map(m => m[1].replace(/<[^>]+>/g, '').trim());
  const h2s = [...html.matchAll(/<h2[^>]*>([\s\S]*?)<\/h2>/gi)].map(m => m[1].replace(/<[^>]+>/g, '').trim());
  const navs = [...html.matchAll(/<(?:nav|aside|header)[^>]*>([\s\S]*?)<\/(?:nav|aside|header)>/gi)].map(m => m[1].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 150));
  
  // Extract all buttons on this page
  const buttons = [...html.matchAll(/<button[^>]*>([\s\S]*?)<\/button>/gi)].map(m => m[1].replace(/<[^>]+>/g, '').trim()).filter(Boolean);
  
  console.log(`\n=================== Page ${index + 1}: ${id} ===================`);
  console.log('Title:', title);
  console.log('H1:', h1s);
  console.log('H2:', h2s);
  console.log('Nav sample:', navs.slice(0, 2));
  console.log('Buttons:', [...new Set(buttons)]);
});

