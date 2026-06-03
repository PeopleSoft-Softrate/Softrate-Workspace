const fs = require('fs');
const path = require('path');

function walk(dir) {
  let results = [];
  const list = fs.readdirSync(dir);
  list.forEach((file) => {
    file = path.join(dir, file);
    const stat = fs.statSync(file);
    if (stat && stat.isDirectory() && !file.includes('node_modules')) {
      results = results.concat(walk(file));
    } else if (file.endsWith('.css')) {
      results.push(file);
    }
  });
  return results;
}

const apps = [
  'apps/peoplespft-multi terent/src/app/features',
  'apps/hrms/emp-hr/src/app/features'
];

apps.forEach(app => {
  const cssFiles = walk(path.join(__dirname, app));
  cssFiles.forEach(file => {
    let content = fs.readFileSync(file, 'utf8');
    let changed = false;

    // Find .main-content-layout blocks and force background to var(--hc-bg)
    // Actually, we can just look for background: #f4f6f8, background: #f9fafb, background: #f1f5f9
    // or just anything that looks like a main page layout background.
    
    // Instead of regex matching blocks, let's just replace the specific background colors that look like page backgrounds
    // #f4f6f8
    if (content.includes('background: #f4f6f8')) {
      content = content.replace(/background:\s*#f4f6f8/g, 'background: var(--hc-bg)');
      changed = true;
    }
    // #f9fafb
    if (content.includes('background: #f9fafb')) {
      content = content.replace(/background:\s*#f9fafb/g, 'background: var(--hc-bg)');
      changed = true;
    }
    // #f8fafc
    if (content.includes('background: #f8fafc')) {
      content = content.replace(/background:\s*#f8fafc/g, 'background: var(--hc-bg)');
      changed = true;
    }
    if (content.includes('background-color: #f8fafc')) {
      content = content.replace(/background-color:\s*#f8fafc/g, 'background-color: var(--hc-bg)');
      changed = true;
    }

    if (changed) {
      fs.writeFileSync(file, content);
      console.log('Updated ' + file);
    }
  });
});
