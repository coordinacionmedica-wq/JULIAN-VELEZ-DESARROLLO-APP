const { execSync } = require('child_process');
try {
  const result = execSync('npx vite build', { encoding: 'utf8', timeout: 60000 });
  console.log(result);
} catch (e) {
  console.log('STDOUT:', e.stdout);
  console.log('STDERR:', e.stderr);
  process.exit(1);
}
