// Check committed content, not local profiles or private backup directories.
const fs = require('node:fs');
const cp = require('node:child_process');
const files = cp.execFileSync('git', ['ls-files', '-z'], {encoding:'utf8'}).split('\0').filter(Boolean);
const patterns = [
  /-----BEGIN (?:OPENSSH|RSA|EC|DSA|PRIVATE).*PRIVATE KEY-----/,
  /\b(?:gh[pousr]_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{50,})\b/,
  /\bAKIA[0-9A-Z]{16}\b/,
  /C:[\\/]Users[\\/]/i,
  /\bS-1-5-21-[0-9-]+/,
  /\b(?:[0-9A-Fa-f]{2}:){5}[0-9A-Fa-f]{2}\b/
];
let failed = false;
for (const file of files) {
  if (!fs.existsSync(file)) continue;
  const privateName = /(?:^|\/)(?:api-token|profile\.json|server_host|server_ip)$|\.(?:url|pem|key|log|ipk)$/i.test(file);
  const content = fs.readFileSync(file);
  const suspicious = !file.endsWith('.png') && patterns.some(pattern => pattern.test(content.toString('utf8')));
  if (privateName || suspicious) { console.error('Review publication content: ' + file); failed = true; }
}
const identities = cp.execFileSync('git', ['log', '--all', '--format=%ae%n%ce'], {encoding:'utf8'}).trim().split(/\r?\n/).filter(Boolean);
for (const email of identities) {
  if (email !== 'contributors@webos-tun.invalid' && !/^[^@]+@users\.noreply\.github\.com$/.test(email)) {
    console.error('Commit history contains a non-neutral email address; value withheld.'); failed = true;
  }
}
if (failed) process.exitCode = 1;
else console.log('PASS publication checks: source files and commit identities');
