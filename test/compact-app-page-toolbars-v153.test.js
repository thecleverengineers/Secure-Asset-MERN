import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const read = (file) => readFileSync(new URL(`../${file}`, import.meta.url), 'utf8');

test('requested app workspaces use compact toolbars instead of hero headers', () => {
  const compactToolbar = read('src/app/components/layout/CompactPageToolbar.tsx');
  assert.match(compactToolbar, /data-secureasset-compact-page-toolbar/);
  assert.doesNotMatch(compactToolbar, /var\(--sa-navigation\)/);
  assert.doesNotMatch(compactToolbar, /width: 230/);

  const requestedPages = [
    ['src/app/pages/app/SubscriptionPage.tsx', 'subscription-toolbar-v153'],
    ['src/app/pages/app/SecurityPage.tsx', 'security-toolbar-v153'],
    ['src/app/pages/app/MessagingPage.tsx', 'messages-toolbar-v153'],
    ['src/app/pages/app/PropertyManagementPage.tsx', 'property-management-toolbar-v153'],
    ['src/app/pages/app/PropertyVisitsPage.tsx', 'property-visits-toolbar-v153'],
    ['src/app/pages/app/AgreementTemplatesPage.tsx', 'agreement-templates-toolbar-v153'],
    ['src/app/pages/app/SurveyJobsWorkspacePage.tsx', 'survey-jobs-toolbar-v153'],
    ['src/app/pages/app/SurveyJobMarketplacePage.tsx', 'survey-job-marketplace-toolbar-v153'],
    ['src/app/pages/app/SurveyProposalsPage.tsx', 'survey-quotations-toolbar-v153'],
    ['src/app/pages/app/SurveyProjectsWorkflowPage.tsx', 'survey-projects-toolbar-v164'],
  ];

  for (const [file, marker] of requestedPages) {
    const source = read(file);
    assert.match(source, /CompactPageToolbar/);
    assert.match(source, new RegExp(marker));
    assert.doesNotMatch(source, /PageHeader/);
  }

  const notifications = read('src/app/pages/app/NotificationCenterPage.tsx');
  assert.match(notifications, /data-secureasset-notification-center="reference-panel-v160"/);
  assert.match(notifications, /data-secureasset-notification-mark-all="functional-v160"/);
  assert.doesNotMatch(notifications, /CompactPageToolbar/);
  assert.doesNotMatch(notifications, /PageHeader/);

  const projects = read('src/app/pages/app/SurveyProjectsWorkflowPage.tsx');
  assert.match(projects, /survey-project-detail-toolbar-v153/);
  assert.doesNotMatch(projects, /background: 'linear-gradient\(135deg, #075777/);
});

test('all requested resource routes use the compact toolbar and retain page actions', () => {
  const resource = read('src/app/pages/app/ResourcePage.tsx');
  const expectedModules = [
    'properties', 'applications', 'tenant-interviews', 'property-visits', 'tenancies', 'rental-invoices',
    'utility-readings', 'reminder-rules', 'tenant-profiles', 'occupants', 'leases', 'payments', 'complaints',
    'facilities', 'facility-bookings', 'agreement-templates', 'survey-jobs', 'survey-quotations', 'survey-projects',
  ];

  assert.match(resource, /const COMPACT_RESOURCE_MODULES = new Set/);
  for (const module of expectedModules) assert.match(resource, new RegExp(`'${module}'`));
  assert.match(resource, /const compactRequestedResourceView = isMyListings \|\| COMPACT_RESOURCE_MODULES\.has\(module\);/);
  assert.match(resource, /compactRequestedResourceView \? <CompactPageToolbar/);
  assert.match(resource, /title=\{isMyListings \? 'My Listings' : moduleLabel\(module\)\}/);
  assert.match(resource, /Add \$\{config\.singular\}/);
  assert.match(resource, /downloadReport\(module, 'csv'\)/);
});

test('compact page conversions preserve each workspace action', () => {
  assert.match(read('src/app/pages/app/PropertyManagementPage.tsx'), /Add property/);
  assert.match(read('src/app/pages/app/AgreementTemplatesPage.tsx'), /New template/);
  assert.match(read('src/app/pages/app/SurveyJobsWorkspacePage.tsx'), /Post survey job/);
  assert.match(read('src/app/pages/app/SurveyJobMarketplacePage.tsx'), /My proposals/);
  assert.match(read('src/app/pages/app/SurveyProjectsWorkflowPage.tsx'), /All projects/);
  assert.match(read('src/app/pages/app/NotificationCenterPage.tsx'), /Mark all as read/);
});
