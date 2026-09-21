import { access, readFile, readdir, stat } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const root = process.cwd();
const artifactDirectory = path.join(root, '.open-next');
const envCandidates = [
  '.env',
  '.env.local',
  '.env.production',
  '.env.production.local',
];
const knownSensitiveKeys = new Set([
  'CRON_SECRET',
  'SUPABASE_SECRET_KEY',
  'SUPABASE_SERVICE_ROLE_KEY',
]);
const sensitiveKeyPattern = /(?:^|_)(?:SECRET|TOKEN|PASSWORD|PRIVATE_KEY|SERVICE_ROLE_KEY)(?:$|_)/;

function unquote(value) {
  if (value.length >= 2) {
    const first = value.at(0);
    const last = value.at(-1);
    if ((first === '"' && last === '"') || (first === "'" && last === "'")) {
      return value.slice(1, -1);
    }
  }
  return value;
}

function parseSensitiveValues(source) {
  const values = [];

  for (const rawLine of source.split(/\r?\n/u)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;

    const normalized = line.startsWith('export ') ? line.slice(7).trim() : line;
    const separator = normalized.indexOf('=');
    if (separator <= 0) continue;

    const key = normalized.slice(0, separator).trim();
    if (key.startsWith('NEXT_PUBLIC_')) continue;
    if (!knownSensitiveKeys.has(key) && !sensitiveKeyPattern.test(key)) continue;

    const value = unquote(normalized.slice(separator + 1).trim());
    if (value.length < 8 || value.startsWith('$')) continue;
    values.push({ key, value: Buffer.from(value, 'utf8') });
  }

  return values;
}

async function collectArtifactFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...await collectArtifactFiles(absolute));
    } else if (entry.isFile() && !entry.name.endsWith('.map')) {
      files.push(absolute);
    }
  }

  return files;
}

try {
  await access(artifactDirectory);
} catch {
  console.error('Cloudflare bundle not found. Run the OpenNext build first.');
  process.exit(1);
}

const sensitiveValues = [];
for (const candidate of envCandidates) {
  try {
    const source = await readFile(path.join(root, candidate), 'utf8');
    sensitiveValues.push(...parseSensitiveValues(source));
  } catch (error) {
    if (error?.code !== 'ENOENT') throw error;
  }
}

if (sensitiveValues.length === 0) {
  console.log('Cloudflare bundle secret check passed (no local private values to compare).');
  process.exit(0);
}

const files = await collectArtifactFiles(artifactDirectory);
const findings = [];

for (const file of files) {
  const fileStat = await stat(file);
  if (fileStat.size === 0) continue;
  const content = await readFile(file);

  for (const secret of sensitiveValues) {
    if (content.includes(secret.value)) {
      findings.push({
        key: secret.key,
        file: path.relative(root, file),
      });
    }
  }
}

if (findings.length > 0) {
  console.error('Deployment blocked: private environment values were embedded in the Cloudflare bundle.');
  for (const finding of findings) {
    console.error(`- ${finding.key} found in ${finding.file}`);
  }
  console.error('Build with public build-time variables only and keep private values as Cloudflare runtime secrets.');
  process.exit(1);
}

console.log('Cloudflare bundle secret check passed.');
