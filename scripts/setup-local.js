import fs from 'fs';
import crypto from 'crypto';
import path from 'path';

const root = process.cwd();
const examplePath = path.join(root, '.env.example');
const envPath = path.join(root, '.env');

if (!fs.existsSync(examplePath)) {
  console.error('Missing .env.example in the project root.');
  process.exit(1);
}

if (fs.existsSync(envPath)) {
  console.log('.env already exists. No changes were made.');
} else {
  let content = fs.readFileSync(examplePath, 'utf8');
  content = content
    .replace('replace-with-a-long-random-access-secret', crypto.randomBytes(48).toString('hex'))
    .replace('replace-with-a-different-long-random-refresh-secret', crypto.randomBytes(48).toString('hex'));
  fs.writeFileSync(envPath, content, { mode: 0o600 });
  console.log('Created .env with randomly generated JWT secrets.');
}

console.log('\nNext steps:');
console.log('1. Ensure MongoDB is running locally, or place an Atlas URI in MONGODB_URI.');
console.log('2. Run: npm install');
console.log('3. Run: npm run seed');
console.log('4. Run: npm run dev');
console.log('\nWindows PowerShell policy issue? Use npm.cmd instead of npm.');
