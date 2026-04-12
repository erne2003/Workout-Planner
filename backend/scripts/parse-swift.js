const fs = require('fs');
const path = require('path');

function parseSwift(filePath) {
    const raw = fs.readFileSync(filePath, 'utf8');
    
    const parts = [];
    
    // Quick regex to find BodyPartPathData
    const regex = /BodyPartPathData\s*\(\s*slug:\s*\.([a-zA-Z]+)\s*,([\s\S]*?)\)/g;
    
    let match;
    while ((match = regex.exec(raw)) !== null) {
        const slug = match[1];
        const pathsStr = match[2];
        
        let pathsArray = [];
        
        // Find strings inside the body part
        const strRegex = /"([^"]+)"/g;
        let strMatch;
        while ((strMatch = strRegex.exec(pathsStr)) !== null) {
            pathsArray.push(strMatch[1]);
        }
        
        parts.push({
            slug,
            paths: pathsArray
        });
    }
    
    return parts;
}

const front = parseSwift(path.join(__dirname, '../../src/lib/MaleFrontPaths.swift'));
const back = parseSwift(path.join(__dirname, '../../src/lib/MaleBackPaths.swift'));

let output = `// Auto-generated MuscleMap SDK Paths\n\n`;

function generateArray(parts, name) {
    let out = `export const ${name} = [\n`;
    parts.forEach(p => {
        out += `  {\n`;
        out += `    id: "${p.slug}",\n`;
        out += `    d: "${p.paths.join(' ')}"\n`;
        out += `  },\n`;
    });
    out += `];\n\n`;
    return out;
}

output += generateArray(front, "ANTERIOR_PATHS");
output += generateArray(back, "POSTERIOR_PATHS");

fs.writeFileSync(path.join(__dirname, '../../src/lib/muscle-paths.js'), output);
console.log("Parsed SVG successfully into muscle-paths.js");
