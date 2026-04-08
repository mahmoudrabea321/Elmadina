const fs = require('fs');
const content = fs.readFileSync('app.js', 'utf8');
const newContent = content.replace(/ر\.س/g, 'ج.م');
fs.writeFileSync('app.js', newContent);
console.log('Replaced currency in app.js');
