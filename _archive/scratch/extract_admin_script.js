const fs = require('fs');
const filePath = 'd:\\20250728OD\\OneDrive\\Apps\\WEBAPP\\INTERN-PORT\\admin.html';
const content = fs.readFileSync(filePath, 'utf8');

// Find the last script tag content
const scripts = content.match(/<script([\s\S]*?)>([\s\S]*?)<\/script>/g);
if (scripts) {
    const lastScript = scripts[scripts.length - 1];
    const scriptContent = lastScript.match(/<script[\s\S]*?>([\s\S]*?)<\/script>/)[1];
    fs.writeFileSync('scratch_admin_main.js', scriptContent);
    console.log('Last script extracted');
}
