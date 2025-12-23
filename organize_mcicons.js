const fs = require('fs');
const path = require('path');
const https = require('https');

const API_URL = 'https://hydrogenchloride.vercel.app/api/assets';
const BASE_DIR = path.join(process.cwd(), 'mcicons');

async function fetchData(url) {
    return new Promise((resolve, reject) => {
        https.get(url, (res) => {
            let data = '';
            res.on('data', (chunk) => data += chunk);
            res.on('end', () => resolve(JSON.parse(data)));
            res.on('error', reject);
        });
    });
}

async function downloadFile(url, dest) {
    return new Promise((resolve, reject) => {
        const file = fs.createWriteStream(dest);
        https.get(url, (res) => {
            res.pipe(file);
            file.on('finish', () => {
                file.close();
                resolve();
            });
        }).on('error', (err) => {
            fs.unlink(dest, () => reject(err));
        });
    });
}

async function main() {
    try {
        console.log('Fetching assets data...');
        const assets = await fetchData(API_URL);
        console.log(`Found ${assets.length} assets.`);

        if (!fs.existsSync(BASE_DIR)) {
            fs.mkdirSync(BASE_DIR, { recursive: true, mode: 0o755 });
        }

        const categories = new Set();
        const subcategories = new Set();

        for (const asset of assets) {
            const { category, subcategory, name, url } = asset;
            
            let targetDir = path.join(BASE_DIR, category);
            if (subcategory && subcategory.trim() !== "") {
                targetDir = path.join(targetDir, subcategory);
            }

            if (!fs.existsSync(targetDir)) {
                fs.mkdirSync(targetDir, { recursive: true, mode: 0o755 });
            }

            categories.add(category);
            if (subcategory) subcategories.add(`${category}/${subcategory}`);

            const targetPath = path.join(targetDir, name);
            console.log(`Downloading: ${category}${subcategory ? '/' + subcategory : ''}/${name}`);
            
            try {
                await downloadFile(url, targetPath);
            } catch (err) {
                console.error(`Failed to download ${name}: ${err.message}`);
            }
        }

        console.log('\nOrganization Summary:');
        console.log(`Total Assets: ${assets.length}`);
        console.log(`Categories: ${categories.size}`);
        console.log(`Subcategories: ${subcategories.size}`);
        
        // Generate README.md
        const readmeContent = `# MC Icons Organization

This directory contains assets fetched from the MC Icons API.

## Structure
The assets are organized hierarchically based on their category and subcategory as defined in the source API.

- \`mcicons/\`
  - \`[Category]/\`
    - \`[Subcategory]/\` (if applicable)
      - \`asset_file.ext\`

## Categories Found
${Array.from(categories).sort().map(c => `- ${c}`).join('\n')}

## Metadata
- **Source API**: ${API_URL}
- **Last Updated**: ${new Date().toISOString()}
`;

        fs.writeFileSync(path.join(BASE_DIR, 'README.md'), readmeContent);
        console.log('README.md created.');

    } catch (error) {
        console.error('An error occurred:', error);
    }
}

main();
