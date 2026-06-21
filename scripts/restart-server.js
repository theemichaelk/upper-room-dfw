#!/usr/bin/env node
const { spawn, execSync } = require('child_process');
const path = require('path');

const PORT = process.env.PORT || '8000';
const root = path.join(__dirname, '..');

function killPort(port) {
  try {
    if (process.platform === 'win32') {
      const out = execSync(`netstat -ano | findstr :${port}`, { encoding: 'utf8' });
      const pids = new Set();
      out.split('\n').forEach((line) => {
        const m = line.trim().match(/LISTENING\s+(\d+)/);
        if (m) pids.add(m[1]);
      });
      pids.forEach((pid) => {
        try { execSync(`taskkill /PID ${pid} /F`); } catch { /* ignore */ }
      });
    } else {
      execSync(`lsof -ti:${port} | xargs kill -9 2>/dev/null || true`, { shell: true });
    }
  } catch { /* port free */ }
}

killPort(PORT);
const child = spawn('node', ['server/index.js'], {
  cwd: root,
  stdio: 'inherit',
  shell: true,
  env: { ...process.env, PORT: String(PORT) },
});
child.on('exit', (code) => process.exit(code ?? 0));