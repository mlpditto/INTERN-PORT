const fs = require('fs');
const path = require('path');

const filePath = 'd:\\20250728OD\\OneDrive\\Apps\\WEBAPP\\INTERN-PORT\\index.html';
const content = fs.readFileSync(filePath, 'utf8');

const scriptMatch = content.match(/<script>([\s\S]*?)<\/script>/);
if (scriptMatch) {
    const script = scriptMatch[1];
    fs.writeFileSync('scratch_script.js', script);
    console.log('Script extracted to scratch_script.js');
} else {
    console.log('No script tag found');
}
