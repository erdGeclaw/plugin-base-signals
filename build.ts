import { execSync } from 'child_process';

const watch = process.argv.includes('--watch');

const buildOptions = {
  entrypoints: ['src/index.ts'],
  outdir: 'dist',
  format: 'esm' as const,
  target: 'node' as const,
  external: ['@elizaos/core'],
};

async function build() {
  console.log('Building plugin-base-signals...');
  const result = await Bun.build(buildOptions);
  if (!result.success) {
    console.error('Build failed:', result.logs);
    process.exit(1);
  }
  
  // Generate types
  execSync('bunx tsc --emitDeclarationOnly --declaration --outDir dist', { stdio: 'inherit' });
  
  console.log('✅ Build complete');
}

build();
