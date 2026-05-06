const fs = require('fs');
const path = require('path');

const mciconsPath = path.join(__dirname, 'mcicons');

fs.readdir(mciconsPath, { withFileTypes: true }, (err, items) => {
  if (err) {
    console.error('Error reading mcicons folder:', err);
    return;
  }

  items.forEach(item => {
    if (item.isDirectory()) {
      const oldPath = path.join(mciconsPath, item.name);
      
      const newName = item.name
        .toLowerCase()
        .replace(/[^a-z\s]/g, '')
        .replace(/\s+/g, '')
        .trim();
      
      const newPath = path.join(mciconsPath, newName);
      
      if (oldPath !== newPath) {
        fs.rename(oldPath, newPath, (err) => {
          if (err) {
            console.error(`Error renaming ${item.name} to ${newName}:`, err);
          } else {
            console.log(`Renamed: ${item.name} → ${newName}`);
          }
        });
      }
    }
  });
});
