import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read=(path)=>fs.readFileSync(path,'utf8');

test('My Survey Quotes uses a premium record layout instead of card tiles',()=>{
  const page=read('src/app/pages/app/SurveyJobsWorkspacePage.tsx');
  assert.match(page,/Surveyor \/ Quote/);
  assert.match(page,/Property/);
  assert.match(page,/Survey Details/);
  assert.match(page,/Budget/);
  assert.match(page,/Status/);
  assert.match(page,/Action/);
  assert.match(page,/QT-\$\{String\(item\._id\|\|''\)\.slice\(-7\)\.toUpperCase\(\)\}/);
  assert.doesNotMatch(page,/Grid size=\{\{xs:12,md:6\}\} key=\{item\._id\}>\s*<Card/);
});

test('quote records are desktop columns and mobile stacked rows',()=>{
  const page=read('src/app/pages/app/SurveyJobsWorkspacePage.tsx');
  assert.match(page,/display:\{xs:'none',md:'block'\}/);
  assert.match(page,/display:\{md:'none'\}/);
  assert.match(page,/size=\{\{xs:12,md:2\.4\}\}/);
  assert.match(page,/size=\{\{xs:12,sm:6,md:2\.4\}\}/);
  assert.match(page,/size=\{\{xs:12,md:2\}\}/);
});

test('record actions preserve direct quote status workflow',()=>{
  const page=read('src/app/pages/app/SurveyJobsWorkspacePage.tsx');
  assert.match(page,/Awaiting review/);
  assert.match(page,/Open Project/);
  assert.match(page,/Request Again/);
  assert.match(page,/getMySurveyorQuoteRequests/);
});
