const fs = require('fs');
const path = require('path');

const srcDir = path.join(__dirname, 'src', 'app');

function getRelativePath(fromPath, toPath) {
  let relative = path.relative(path.dirname(fromPath), toPath);
  if (!relative.startsWith('.')) {
    relative = './' + relative;
  }
  // Remove .ts extension for imports
  return relative.replace(/\.ts$/, '');
}

function processFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf-8');

  // Skip if it doesn't have alert(
  if (!content.includes('alert(')) {
    return;
  }

  // Calculate relative path to alert service
  const servicePath = path.join(srcDir, 'shared', 'services', 'alert.ts');
  const importPath = getRelativePath(filePath, servicePath);

  let modified = false;

  // 1. Ensure inject is imported from @angular/core
  if (!content.includes('import { AlertService }')) {
    content = `import { AlertService } from '${importPath}';\n` + content;
    modified = true;
  }
  
  if (!content.includes('inject(') && content.includes('@angular/core')) {
    content = content.replace(/import\s+{([^}]+)}\s+from\s+['"]@angular\/core['"]/, (match, p1) => {
      if (!p1.includes('inject')) {
        return `import { ${p1.trim()}, inject } from '@angular/core'`;
      }
      return match;
    });
    modified = true;
  }

  // 2. Inject AlertService into the class
  // Find the class definition
  const classRegex = /export class [A-Za-z0-9_]+ (implements [A-Za-z0-9_, ]+ )?\{/;
  const match = content.match(classRegex);
  if (match && !content.includes('alertService = inject(AlertService)')) {
    const insertPos = match.index + match[0].length;
    content = content.slice(0, insertPos) + '\n  private alertService = inject(AlertService);\n' + content.slice(insertPos);
    modified = true;
  }

  // 3. Replace alert( with this.alertService.show(
  // But be careful not to replace something else that happens to have alert(
  // Typically it looks like alert('message')
  if (content.includes('alert(')) {
    content = content.replace(/\balert\s*\(/g, 'this.alertService.show(');
    modified = true;
  }

  if (modified) {
    fs.writeFileSync(filePath, content, 'utf-8');
    console.log(`Updated ${filePath}`);
  }
}

function walkDir(dir) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      walkDir(fullPath);
    } else if (fullPath.endsWith('.ts') && !fullPath.includes('.spec.ts')) {
      processFile(fullPath);
    }
  }
}

walkDir(srcDir);
console.log('Refactor complete!');
