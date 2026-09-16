import process from 'node:process';

const REQUIRED_NODE = [24, 18, 0];
const REQUIRED_NPM = [11, 16, 0];

function parse(version = '') {
  return String(version).replace(/^v/, '').split('.').slice(0, 3).map(Number);
}
function atLeast(current, required) {
  return current.length === 3 && current.every(Number.isInteger) && (
    current[0] > required[0]
    || (current[0] === required[0] && current[1] > required[1])
    || (current[0] === required[0] && current[1] === required[1] && current[2] >= required[2])
  );
}

const node = parse(process.versions.node);
if (!atLeast(node, REQUIRED_NODE) || node[0] >= 25) {
  console.error(`Unsupported Node.js ${process.versions.node}. SecureAsset production requires Node.js >=24.18.0 <25.`);
  console.error('Install Node.js 24 LTS, remove node_modules, then run npm ci --include=dev.');
  process.exit(1);
}

const npmVersion = process.env.npm_config_user_agent?.match(/npm\/(\d+\.\d+\.\d+)/)?.[1];
if (npmVersion) {
  const npm = parse(npmVersion);
  if (!atLeast(npm, REQUIRED_NPM) || npm[0] >= 12) {
    console.error(`Unsupported npm ${npmVersion}. SecureAsset production requires npm >=11.16.0 <12.`);
    process.exit(1);
  }
}
console.log(`Runtime accepted: Node.js ${process.versions.node}${npmVersion ? `, npm ${npmVersion}` : ''}.`);
