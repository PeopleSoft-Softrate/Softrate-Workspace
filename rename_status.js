const fs = require('fs');
const glob = require('glob');

const files = glob.sync('{apps/sales/emp/src,apps/sales/admin-crm/src,services/sales}/**/*.{ts,js,html}', { nodir: true });

files.forEach(file => {
  let content = fs.readFileSync(file, 'utf8');
  if (content.includes("'Contacted'") || content.includes('"Contacted"') || content.includes('>Contacted<')) {
    let newContent = content
      .replace(/'Contacted'/g, "'Connected'")
      .replace(/"Contacted"/g, '"Connected"')
      .replace(/>Contacted</g, '>Connected<');
    fs.writeFileSync(file, newContent);
    console.log(`Updated ${file}`);
  }
});
console.log('Done file replacements.');
