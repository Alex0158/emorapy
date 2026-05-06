const requiredValue = '1';

if (process.env.DOCS_AUDIT_SYNC_CONFIRMED === requiredValue) {
  console.log('[core-docs-audit-sync] confirmed');
  process.exit(0);
}

console.error('[core-docs-audit-sync] refusing broad metadata/ledger sync without confirmation');
console.error('');
console.error('Run dry-run first and review current/non-current impact:');
console.error('  npm run docs:audit:dry-run');
console.error('');
console.error('Then, only if the broad rewrite is intended, run:');
console.error('  DOCS_AUDIT_SYNC_CONFIRMED=1 npm run docs:audit:sync');
console.error('');
console.error('For routine formal-doc work, prefer:');
console.error('  npm run docs:audit:dry-run:current');
console.error('  node scripts/sync-core-docs-metadata.mjs --dry-run --prefix <path>');

process.exit(1);
