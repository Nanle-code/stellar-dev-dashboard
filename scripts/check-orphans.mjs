import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = path.resolve(__dirname, '..');
const dashboardDir = path.join(root, 'src', 'components', 'dashboard');
const srcDir = path.join(root, 'src');

function getAllFiles(dir, ext = ['.tsx', '.ts', '.js', '.jsx']) {
    let results = [];
    if (!fs.existsSync(dir)) return results;
    const list = fs.readdirSync(dir);
    list.forEach(file => {
        file = path.join(dir, file);
        const stat = fs.statSync(file);
        if (stat && stat.isDirectory()) {
            results = results.concat(getAllFiles(file, ext));
        } else {
            if (ext.some(e => file.endsWith(e))) {
                results.push(file);
            }
        }
    });
    return results;
}

const dashboardFiles = getAllFiles(dashboardDir);
const allSrcFiles = getAllFiles(srcDir);

const fileContentMap = new Map();
allSrcFiles.forEach(f => {
    fileContentMap.set(f, fs.readFileSync(f, 'utf-8'));
});

const orphans = [];

for (const df of dashboardFiles) {
    if (df.includes('types.ts')) continue;
    if (df.includes('.test.') || df.includes('.stories.')) continue;
    
    const baseName = path.basename(df, path.extname(df));
    let isImported = false;
    
    for (const [srcF, content] of fileContentMap.entries()) {
        if (srcF === df) continue;
        const dfStr = df.replace(/\\/g, '/');
        const srcFStr = srcF.replace(/\\/g, '/');
        if (dfStr.includes('/tests/') && srcFStr.includes('/tests/')) continue;
        if (srcFStr.includes('.test.') || srcFStr.includes('.stories.')) continue;
        
        const regex1 = new RegExp(`['"\`].*?${baseName}['"\`]`, 'i');
        if (regex1.test(content)) {
            isImported = true;
            break;
        }
    }
    
    if (!isImported) {
        orphans.push(df);
    }
}

if (orphans.length > 0) {
    console.error(`Found ${orphans.length} orphaned files in src/components/dashboard:`);
    orphans.forEach(o => console.error(path.relative(root, o).replace(/\\/g, '/')));
    process.exit(1);
} else {
    console.log("No orphaned files found in src/components/dashboard.");
    process.exit(0);
}
