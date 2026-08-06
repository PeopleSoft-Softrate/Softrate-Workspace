const fs = require('fs');
const path = require('path');

function findHtmlFiles(dir, fileList = []) {
  const files = fs.readdirSync(dir);
  
  for (const file of files) {
    if (file === 'node_modules' || file === 'dist' || file.startsWith('.')) {
      continue;
    }
    
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    
    if (stat.isDirectory()) {
      findHtmlFiles(filePath, fileList);
    } else if (stat.isFile() && file.endsWith('.html')) {
      fileList.push(filePath);
    }
  }
  
  return fileList;
}

const appsDir = path.join('c:/projects/Softrate-Workspace/apps');
const htmlFiles = findHtmlFiles(appsDir);

let modifiedFiles = 0;

htmlFiles.forEach(file => {
  let content = fs.readFileSync(file, 'utf8');
  let original = content;

  // Find overlay divs and replace (click) with (mousedown)
  let regex = /(<div\s+[^>]*class="[^"]*(?:overlay|modal-overlay|invoice-overlay)[^"]*"[^>]*)(\(click\)=)/gi;
  
  content = content.replace(regex, (match, before, clickAttr) => {
    return before + '(mousedown)=';
  });

  // Find inner modals and add (mousedown)="$event.stopPropagation()"
  let innerRegex = /(<div\s+[^>]*class="[^"]*(?:modal-content|invoice-modal|modal-container|company-remarks-modal|ai-brief-modal|client-onboarding-modal|followup-modal|mail-sidebar-panel|admin-ai-modal)[^"]*"[^>]*)(\(click\)="\$event\.stopPropagation\(\)")/gi;
  
  content = content.replace(innerRegex, (match, before, clickStop) => {
     if (before.includes('(mousedown)="')) return match; // already has it
     return before + '(mousedown)="$event.stopPropagation()" ' + clickStop;
  });

  if (content !== original) {
    fs.writeFileSync(file, content);
    modifiedFiles++;
    console.log(`Updated ${file}`);
  }
});

console.log(`\nFixed drag bug in ${modifiedFiles} files.`);
