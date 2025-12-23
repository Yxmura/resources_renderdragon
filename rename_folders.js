const fs = require('fs');
const path = require('path');

const BASE_DIR = path.join(process.cwd(), 'mcicons');

function cleanName(name) {
    // Remove numbers and special characters, keep only letters and spaces
    // Then trim and convert to lowercase
    let cleaned = name.replace(/[^a-zA-Z ]/g, '').trim().toLowerCase();
    // Replace spaces with underscores for a "smaller" and cleaner look
    cleaned = cleaned.replace(/\s+/g, '_');
    return cleaned;
}

function renameRecursive(currentDir) {
    if (!fs.existsSync(currentDir)) return;

    const items = fs.readdirSync(currentDir);

    for (const item of items) {
        const itemPath = path.join(currentDir, item);
        const stats = fs.statSync(itemPath);

        if (stats.isDirectory()) {
            // First, recurse into subdirectories
            renameRecursive(itemPath);

            // After subdirectories are handled, rename the current directory
            const newName = cleanName(item);
            if (newName && newName !== item) {
                let newPath = path.join(currentDir, newName);
                
                // Handle potential collisions (though unlikely with this dataset)
                let counter = 1;
                const originalNewPath = newPath;
                while (fs.existsSync(newPath) && newPath !== itemPath) {
                    newPath = `${originalNewPath}_${counter}`;
                    counter++;
                }

                if (newPath !== itemPath) {
                    console.log(`Renaming: ${itemPath} -> ${newPath}`);
                    fs.renameSync(itemPath, newPath);
                }
            }
        }
    }
}

function updateReadme() {
    const readmePath = path.join(BASE_DIR, 'README.md');
    if (!fs.existsSync(readmePath)) return;

    console.log('Updating README.md...');
    let content = fs.readFileSync(readmePath, 'utf8');
    
    // Update the Categories Found section
    const categories = fs.readdirSync(BASE_DIR)
        .filter(item => fs.statSync(path.join(BASE_DIR, item)).isDirectory())
        .sort();

    const categoriesSection = `## Categories Found\n${categories.map(c => `- ${c}`).join('\n')}`;
    
    // Simple replacement of the categories section
    content = content.replace(/## Categories Found[\s\S]*?## Metadata/, `${categoriesSection}\n\n## Metadata`);
    
    fs.writeFileSync(readmePath, content);
}

try {
    console.log('Starting folder renaming process...');
    renameRecursive(BASE_DIR);
    console.log('Renaming complete.');
    updateReadme();
    console.log('Process finished successfully.');
} catch (err) {
    console.error('An error occurred during renaming:', err);
}
