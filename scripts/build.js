import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.join(__dirname, '..');
const distDir = path.join(rootDir, 'dist');

// 1. Run Vite Build
console.log('🏗️  Starting Build Process...');
try {
    execSync('npm run build:vite', { stdio: 'inherit', cwd: rootDir });
} catch (e) {
    console.error('❌ Build failed:', e);
    process.exit(1);
}

// 2. Copy PHP
console.log('📄 Copying index.php...');
const phpSource = path.join(rootDir, 'index_corrected.php');
const phpDest = path.join(distDir, 'index.php');

if (fs.existsSync(phpSource)) {
    fs.copyFileSync(phpSource, phpDest);
    console.log('   ✅ index.php copied.');
} else {
    console.error('   ❌ index_corrected.php not found!');
}

// Copy Diagnostic Files
const diagFiles = ['test_hello.php', 'test_db.php', 'test_minimal.php'];
diagFiles.forEach(file => {
    const src = path.join(rootDir, file);
    const dest = path.join(distDir, file);
    if (fs.existsSync(src)) {
        fs.copyFileSync(src, dest);
        console.log(`   ✅ ${file} copied.`);
    }
});

// 3. Generate SQLite
const dbPath = path.join(distDir, 'ffw_licenses.sqlite');

const generateDb = async () => {
    if (fs.existsSync(dbPath)) {
        console.log('   ℹ️  Database already exists in dist/, skipping generation.');
        return;
    }

    console.log('🗄️  Generating SQLite database...');

    let sqlite3;
    try {
        const module = await import('sqlite3');
        sqlite3 = module.default;
    } catch (e) {
        console.warn('   ⚠️  WARNING: sqlite3 module not found. Skipping database generation.');
        console.warn('       Please run "npm install" to install dependencies on the server.');
        return;
    }

    const db = new sqlite3.Database(dbPath);

    db.serialize(() => {
        // Licenses Table
        db.run(`CREATE TABLE IF NOT EXISTS licenses (
          id TEXT PRIMARY KEY,
          organization TEXT,
          contactPerson TEXT,
          email TEXT,
          domain TEXT,
          key TEXT,
          validUntil TEXT,
          status TEXT,
          features TEXT,
          createdAt TEXT,
          phoneNumber TEXT,
          note TEXT
        )`);

        // Requests Table
        db.run(`CREATE TABLE IF NOT EXISTS requests (
          id TEXT PRIMARY KEY,
          organization TEXT,
          contactPerson TEXT,
          email TEXT,
          requestedDomain TEXT,
          requestDate TEXT,
          note TEXT,
          phoneNumber TEXT,
          customMessage TEXT
        )`);

        // Logs Table
        db.run(`CREATE TABLE IF NOT EXISTS logs (
          id TEXT PRIMARY KEY,
          timestamp TEXT,
          method TEXT,
          endpoint TEXT,
          sourceUrl TEXT,
          providedKey TEXT,
          responseStatus INTEGER,
          responseBody TEXT
        )`);
    });

    db.close((err) => {
        if (err) {
            console.error('   ❌ Error creating database:', err.message);
        } else {
            console.log('   ✅ Database ffw_licenses.sqlite created.');
        }
    });
};

generateDb().then(() => {
    console.log('🎉 Build complete! Ready for deployment.');
});
