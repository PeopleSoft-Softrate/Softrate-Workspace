const fs = require('fs');
const path = require('path');

const srcDir = path.join(__dirname, 'src', 'app');

function getRelativePath(fromPath, toPath) {
  let relative = path.relative(path.dirname(fromPath), toPath);
  if (!relative.startsWith('.')) {
    relative = './' + relative;
  }
  return relative.replace(/\.ts$/, '');
}

function processFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf-8');

  if (!content.includes('confirm(')) {
    return;
  }

  const servicePath = path.join(srcDir, 'shared', 'services', 'alert.ts');
  const importPath = getRelativePath(filePath, servicePath);

  let modified = false;

  // 1. Ensure AlertService is imported and injected
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

  const classRegex = /export class [A-Za-z0-9_]+ (implements [A-Za-z0-9_, ]+ )?\{/;
  const match = content.match(classRegex);
  if (match && !content.includes('alertService = inject(AlertService)')) {
    const insertPos = match.index + match[0].length;
    content = content.slice(0, insertPos) + '\n  private alertService = inject(AlertService);\n' + content.slice(insertPos);
    modified = true;
  }

  // 2. Replace confirm( with await this.alertService.confirm(
  // Need to find function boundaries and make them async
  // Simple regex to find the method name before the confirm call
  // This is a bit hacky but works for standard Angular component methods
  const lines = content.split('\n');
  let currentMethodLine = -1;
  
  for (let i = 0; i < lines.length; i++) {
    // Detect function signature (e.g. `myMethod() {`, `myMethod(arg: any) {`)
    // that doesn't start with space space space (to skip deep blocks if possible, or just track last function)
    if (/^\s*[a-zA-Z0-9_]+\s*\([^)]*\)\s*(:\s*[a-zA-Z0-9_<>]+)?\s*\{/.test(lines[i])) {
       // if it doesn't have async already
       currentMethodLine = i;
    }
    
    if (lines[i].includes('confirm(') && !lines[i].includes('alertService.confirm(')) {
       // Make current method async
       if (currentMethodLine !== -1 && !lines[currentMethodLine].includes('async ')) {
          lines[currentMethodLine] = lines[currentMethodLine].replace(/^\s*([a-zA-Z0-9_]+)/, (m, p1) => {
             // skip if constructor or get
             if (p1 === 'constructor' || p1 === 'get' || p1 === 'set' || p1 === 'ngOnInit') {
                return m;
             }
             return m.replace(p1, `async ${p1}`);
          });
       }
       
       // Replace confirm with await
       lines[i] = lines[i].replace(/confirm\(/g, 'await this.alertService.confirm(');
       modified = true;
    }
  }

  if (modified) {
    fs.writeFileSync(filePath, lines.join('\n'), 'utf-8');
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
    } else if (fullPath.endsWith('.ts') && !fullPath.includes('.spec.ts') && !fullPath.includes('alert.ts')) {
      processFile(fullPath);
    }
  }
}

walkDir(srcDir);
console.log('Confirm refactor complete!');
