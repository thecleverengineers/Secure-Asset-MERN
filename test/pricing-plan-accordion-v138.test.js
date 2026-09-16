import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

test('pricing cards retain four desktop columns and accessible plan-include accordions', () => {
  const here = path.dirname(fileURLToPath(import.meta.url));
  const page = fs.readFileSync(path.join(here, '..', 'src/app/pages/PublicPages.tsx'), 'utf8');
  assert.match(page, /AccordionSummary/);
  assert.match(page, /Plan includes/);
  assert.match(page, /size=\{\{ xs: 6, md: 3 \}\}/);
  assert.match(page, /borderRadius: '20px'/);
  assert.match(page, /fontFamily: '"Open Sans", Arial, sans-serif'/);
});
