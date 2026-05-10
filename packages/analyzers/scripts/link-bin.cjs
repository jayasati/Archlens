#!/usr/bin/env node
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const cliPath = path.join(root, 'dist', 'cli.js');
const binDir = path.join(root, 'node_modules', '.bin');

if (!fs.existsSync(cliPath)) {
  console.error(`[link-bin] dist/cli.js not found at ${cliPath} — run 'tsc -b' first`);
  process.exit(1);
}

fs.mkdirSync(binDir, { recursive: true });

const shellShim = `#!/bin/sh\nexec node "${cliPath.replace(/\\/g, '/')}" "$@"\n`;
const cmdShim = `@echo off\r\nnode "${cliPath}" %*\r\n`;
const psShim = `#!/usr/bin/env pwsh\nnode "${cliPath}" $args\n`;

fs.writeFileSync(path.join(binDir, 'archlens-analyze'), shellShim, { mode: 0o755 });
fs.writeFileSync(path.join(binDir, 'archlens-analyze.cmd'), cmdShim);
fs.writeFileSync(path.join(binDir, 'archlens-analyze.ps1'), psShim);

console.log('[link-bin] linked archlens-analyze in', binDir);
