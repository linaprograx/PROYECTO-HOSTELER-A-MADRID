const fs = require('fs');

function upgradeFile(file) {
  let content = fs.readFileSync(file, 'utf8');

  // Upgrade font sizes
  content = content.replace(/fontSize:\s*['"](\d+)px['"]/g, (match, p1) => {
    let size = parseInt(p1, 10);
    if (size <= 8) size = 12;
    else if (size === 9) size = 12;
    else if (size === 10) size = 13;
    else if (size === 11) size = 14;
    else if (size === 12) size = 14;
    // Don't change larger fonts as much, maybe just leave them or +1
    return `fontSize:'${size}px'`;
  });

  // Upgrade standard Btn padding
  content = content.replace(/padding:\s*['"]7px 14px['"]/g, "padding:'12px 20px'");
  // Upgrade small Btn padding
  content = content.replace(/padding:\s*['"]4px 10px['"]/g, "padding:'8px 16px'");
  content = content.replace(/padding:\s*['"]6px 12px['"]/g, "padding:'10px 18px'");
  // Upgrade Badge padding
  content = content.replace(/padding:\s*['"]3px 8px['"]/g, "padding:'6px 12px'");

  fs.writeFileSync(file, content, 'utf8');
  console.log(`Upgraded ${file}`);
}

upgradeFile('src/BarOps.jsx');
upgradeFile('src/components/ui/index.jsx');
