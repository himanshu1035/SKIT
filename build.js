const fs = require('fs');
const path = require('path');

const publicDir = path.join(__dirname, 'public');

if (!fs.existsSync(publicDir)) {
  fs.mkdirSync(publicDir, { recursive: true });
}

// Files and directories to mirror into public/
const itemsToCopy = [
  'index.html',
  'manifest.json',
  'sw.js',
  'assets',
  'js',
  'stitch_skit_inventory_design_system'
];

for (const item of itemsToCopy) {
  const src = path.join(__dirname, item);
  const dest = path.join(publicDir, item);

  if (fs.existsSync(src)) {
    fs.cpSync(src, dest, { recursive: true });
    console.log(`Copied ${item} -> public/${item}`);
  }
}

console.log('✅ Static build complete: public/ directory populated successfully.');
