const fs = require('node:fs');
const path = require('node:path');

const skillsRoot = path.join(process.cwd(), '.agents', 'skills');
const allowedKeys = new Set(['name', 'description']);
const errors = [];
const warnings = [];
const seenNames = new Map();

if (!fs.existsSync(skillsRoot)) {
  console.log('Skill validation skipped: .agents/skills does not exist.');
  process.exit(0);
}

const skillDirectories = fs.readdirSync(skillsRoot, { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name)
  .sort();

for (const directoryName of skillDirectories) {
  const skillPath = path.join(skillsRoot, directoryName, 'SKILL.md');
  const label = path.relative(process.cwd(), skillPath);

  if (!fs.existsSync(skillPath)) {
    errors.push(`${label}: missing SKILL.md`);
    continue;
  }

  const source = fs.readFileSync(skillPath, 'utf8').replace(/^\uFEFF/, '');
  const lines = source.split(/\r?\n/);

  if (lines[0] !== '---') {
    errors.push(`${label}: YAML frontmatter must start on the first line with ---`);
    continue;
  }

  const closingDelimiter = lines.indexOf('---', 1);
  if (closingDelimiter === -1) {
    errors.push(`${label}: YAML frontmatter is missing its closing ---`);
    continue;
  }

  const metadata = {};
  for (const line of lines.slice(1, closingDelimiter)) {
    const match = line.match(/^([a-z][a-z0-9_-]*):\s*(.+)$/);
    if (!match) {
      errors.push(`${label}: invalid frontmatter line ${JSON.stringify(line)}`);
      continue;
    }

    const [, key, value] = match;
    if (!allowedKeys.has(key)) {
      errors.push(`${label}: unsupported frontmatter key ${JSON.stringify(key)}`);
    } else if (metadata[key]) {
      errors.push(`${label}: duplicate frontmatter key ${JSON.stringify(key)}`);
    } else {
      metadata[key] = value.trim();
    }
  }

  if (!metadata.name) {
    errors.push(`${label}: missing name`);
  } else {
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(metadata.name) || metadata.name.length > 64) {
      errors.push(`${label}: name must be at most 64 lowercase letters, digits, and hyphens`);
    }
    if (metadata.name !== directoryName) {
      errors.push(`${label}: name ${JSON.stringify(metadata.name)} must match folder ${JSON.stringify(directoryName)}`);
    }
    if (seenNames.has(metadata.name)) {
      errors.push(`${label}: duplicate skill name also used by ${seenNames.get(metadata.name)}`);
    } else {
      seenNames.set(metadata.name, label);
    }
  }

  if (!metadata.description) {
    errors.push(`${label}: missing description`);
  }

  const body = lines.slice(closingDelimiter + 1).join('\n').trim();
  if (!body) {
    errors.push(`${label}: Markdown body is empty`);
  }

  if (directoryName === 'datafut-content' && /^# DataFut Discovery\b/m.test(body)) {
    warnings.push(`${label}: legacy discovery body is intentionally quarantined by its description`);
  }
}

for (const warning of warnings) {
  console.warn(`WARN: ${warning}`);
}

if (errors.length > 0) {
  for (const error of errors) {
    console.error(`ERROR: ${error}`);
  }
  console.error(`Skill validation failed with ${errors.length} error(s).`);
  process.exit(1);
}

console.log(`Skill validation passed for ${skillDirectories.length} skill(s).`);
