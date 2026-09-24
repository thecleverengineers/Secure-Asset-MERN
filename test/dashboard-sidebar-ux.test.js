import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const appShell = readFileSync(new URL('../src/app/components/layout/AppShell.tsx', import.meta.url), 'utf8');
const dashboard = readFileSync(new URL('../src/app/pages/app/RoleDashboardPage.tsx', import.meta.url), 'utf8');
const pageHeader = readFileSync(new URL('../src/app/components/layout/PageHeader.tsx', import.meta.url), 'utf8');
const professionalDialog = readFileSync(new URL('../src/app/components/shared/ProfessionalDialog.tsx', import.meta.url), 'utf8');
const applicationTheme = readFileSync(new URL('../src/app/App.tsx', import.meta.url), 'utf8');
const globalStyles = readFileSync(new URL('../src/styles/globals.css', import.meta.url), 'utf8');
const routes = readFileSync(new URL('../src/app/routes.tsx', import.meta.url), 'utf8');
const frontLayout = readFileSync(new URL('../src/app/components/FrontLayout.tsx', import.meta.url), 'utf8');
const loginPage = readFileSync(new URL('../src/app/pages/LoginPage.tsx', import.meta.url), 'utf8');
const resetPasswordPage = readFileSync(new URL('../src/app/pages/ResetPasswordPage.tsx', import.meta.url), 'utf8');
const authExperience = readFileSync(new URL('../src/app/components/auth/AuthExperience.tsx', import.meta.url), 'utf8');
const designSystem = readFileSync(new URL('../src/app/designSystem.ts', import.meta.url), 'utf8');
const siteAdministration = readFileSync(new URL('../src/app/pages/app/SiteAdministrationPage.tsx', import.meta.url), 'utf8');

function sourceBlock(source, marker) {
  const start = source.indexOf(marker);
  assert.notEqual(start, -1, `Missing source marker: ${marker}`);
  const candidates = [source.indexOf('];', start), source.indexOf('] as const;', start)].filter((index) => index >= 0);
  const end = Math.min(...candidates);
  assert.ok(Number.isFinite(end), `Missing end of source block: ${marker}`);
  return source.slice(start, end + (source.startsWith('] as const;', end) ? '] as const;'.length : 2));
}

test('regular tenant navigation keeps subscription in the profile menu and omits finance destinations', () => {
  const financeMenu = sourceBlock(appShell, 'const regularTenantFinanceMenu: MenuDef[] = [');
  const labels = [...financeMenu.matchAll(/label: '([^']+)'/g)].map((match) => match[1]);

  assert.deepEqual(labels, []);
  const workspaceMenu = sourceBlock(appShell, 'const regularTenantWorkspaceMenu: MenuDef[] = [');
  assert.deepEqual([...workspaceMenu.matchAll(/label: '([^']+)'/g)].map((match) => match[1]), ['Dashboard', 'Document Vault', 'My Applications']);
  assert.match(workspaceMenu, /path: '\/app\/dashboard'/);
  assert.match(workspaceMenu, /path: '\/app\/documents'/);
  assert.match(workspaceMenu, /path: '\/app\/my-applications'/);
  assert.match(appShell, /const regularTenantMenu: MenuDef\[\] = \[\.\.\.regularTenantWorkspaceMenu, \.\.\.regularTenantPropertyMenu, \.\.\.regularTenantFinanceMenu\]/);
  assert.match(appShell, /const regularTenantPropertyMenu: MenuDef\[\] = \[/);
  assert.match(appShell, /isRegularTenant \? regularTenantMenu : placeDocumentVaultAfterDashboard\(designedMenu\)/);
  assert.doesNotMatch(financeMenu, /payments|invoices|receipts/i);
  assert.match(appShell, /data-secureasset-profile-subscription="my-subscription-v84"/);
});

test('sidebar offers smooth, accessible up and down controls when navigation overflows', () => {
  assert.match(appShell, /sidebarScrollRef/);
  assert.match(appShell, /ResizeObserver/);
  assert.match(appShell, /behavior: 'smooth'/);
  assert.match(appShell, /aria-label="Scroll navigation up"/);
  assert.match(appShell, /aria-label="Scroll navigation down"/);
  assert.match(appShell, /scrollSidebar\('up'\)/);
  assert.match(appShell, /scrollSidebar\('down'\)/);
  assert.match(globalStyles, /\.sa-sidebar-scroll/);
  assert.match(globalStyles, /\.sa-sidebar-scroll::-webkit-scrollbar-thumb/);
  assert.match(professionalDialog, /sa-professional-dialog-paper/);
  assert.match(globalStyles, /\.sa-professional-dialog-paper \.MuiDialogContent-root/);
  assert.match(globalStyles, /overflow-y: auto !important/);
});

test('tenant dashboard exposes compact operational quick links instead of finance or vault cards', () => {
  const quickLinks = sourceBlock(dashboard, 'const tenantQuickLinks: readonly DashboardQuickLink[] = [');
  const labels = [...quickLinks.matchAll(/\['([^']+)'/g)].map((match) => match[1]);

  assert.deepEqual(labels, ['My subscription', 'My applications', 'My property', 'Security centre']);
  assert.match(dashboard, /function DashboardQuickLinks/);
  assert.match(dashboard, /Your workspace shortcuts/);
  assert.match(dashboard, /DashboardQuickLinks links=\{isRegularTenant \? tenantQuickLinks : quickLinks\}/);
  assert.match(dashboard, /size=\{\{ xs: 6, md: 3 \}\}/);
  assert.doesNotMatch(dashboard, /Document Vault/);
});

test('document vault is placed immediately after the relevant dashboard for non-regular workspaces', () => {
  assert.match(appShell, /function placeDocumentVaultAfterDashboard\(menu: MenuDef\[\]\)/);
  assert.match(appShell, /item\.key === 'dashboard' \|\| item\.key === 'surveyor-dashboard'/);
  assert.match(appShell, /section: dashboard\.section \|\| 'workspace'/);
  assert.match(appShell, /isRegularTenant \? regularTenantMenu : placeDocumentVaultAfterDashboard\(designedMenu\)/);
  assert.match(appShell, /const regularTenantFinanceMenu: MenuDef\[\] = \[/);
  assert.match(appShell, /const regularTenantWorkspaceMenu: MenuDef\[\] = \[/);
});

test('default headers stay square while the Design Studio safely controls popup and navigation shape', () => {
  assert.match(pageHeader, /borderRadius: premium \? \{ xs: 4, md: 5 \} : 0/);
  assert.match(appShell, /borderRadius: design\.borders\.navigationRadius/);
  assert.match(applicationTheme, /MuiAppBar: \{ styleOverrides: \{ root: \{ borderRadius: 0/);
  assert.match(applicationTheme, /MuiDialog: \{ styleOverrides: \{ paper: \{ borderRadius: design\.borders\.modalRadius/);
  assert.match(professionalDialog, /borderRadius: 'var\(--sa-modal-radius\) !important'/);
  for (const selector of ['.MuiDialog-paper', '.MuiMenu-paper', '.MuiPopover-paper', "[data-slot='dialog-content']", "[data-slot='alert-dialog-content']"]) {
    assert.ok(globalStyles.includes(selector), `Expected popup selector: ${selector}`);
  }
  assert.match(globalStyles, /--sa-modal-radius: 0px/);
  assert.match(globalStyles, /var\(--sa-navigation-radius\)/);
  assert.match(designSystem, /modalRadius: 0/);
  assert.match(siteAdministration, /Application Design Studio/);
  assert.match(siteAdministration, /Cards & tables radius/);
  assert.match(siteAdministration, /Navigation & menus radius/);
});

test('login, registration, and password recovery share the public application shell', () => {
  assert.match(routes, /Component: FrontLayout,[\s\S]*path: 'login', Component: LoginPage/);
  assert.match(routes, /path: 'reset-password', Component: ResetPasswordPage/);
  assert.match(frontLayout, /const headerColor = design\.colors\?\.navigation \|\| '#0B5270'/);
  assert.match(frontLayout, /const navigationRadius = Number\(design\.borders\?\.navigationRadius/);
  assert.match(frontLayout, /component="footer"/);
  assert.match(frontLayout, /sa-global-mobile-bottom-navigation/);
  assert.match(frontLayout, /label="Vault"/);
  assert.match(frontLayout, /label="Property"/);
  assert.match(loginPage, /<AuthExperience/);
  assert.match(resetPasswordPage, /<AuthExperience/);
  assert.match(loginPage, /requestedMode === 'register'/);
  assert.match(authExperience, /Secure by design/);
  assert.match(authExperience, /Need help accessing your account/);
});

test('authenticated public header renders one Dashboard action', () => {
  assert.match(frontLayout, /\{currentUser \? \([\s\S]*startIcon={<DashboardRoundedIcon \/>}[\s\S]*>\s*Dashboard\s*<\/Button>/);
  assert.match(frontLayout, /\{!currentUser && \([\s\S]*\{accountAction\.label\}[\s\S]*\)\}/);
  assert.match(frontLayout, /currentUser\s*\?\s*\{\s*label: 'Dashboard',\s*path: '\/app\/dashboard'/);
});

test('login page places password recovery before the other authentication options', () => {
  assert.match(loginPage, /data-secureasset-forgot-password-link="dedicated-reset-v160" href="\/reset-password"/);
  assert.match(loginPage, /aria-label="Authentication options"/);
  assert.match(loginPage, /authNavigationModes\.map\(\(item\)/);
  assert.ok(loginPage.indexOf('data-secureasset-forgot-password-link') < loginPage.indexOf('aria-label="Authentication options"'));
  assert.doesNotMatch(loginPage, /const authNavigationModes = \['forgot'/);
});

test('authentication pages restore the previous public two-column experience', () => {
  assert.doesNotMatch(authExperience, /mobile-card-v79/);
  assert.match(authExperience, /className="sa-auth-surface"/);
  assert.match(authExperience, /gridTemplateColumns: \{ xs: '1fr', md: 'minmax\(0, \.94fr\) minmax\(440px, 1\.06fr\)' \}/);
  assert.match(authExperience, /Verified access for every role/);
  assert.match(authExperience, /Need help accessing your account/);
  assert.match(loginPage, /LogoMark/);
  assert.match(resetPasswordPage, /LogoMark/);
  assert.doesNotMatch(frontLayout, /!isAuthRoute && <AppBar/);
  assert.doesNotMatch(frontLayout, /!isAuthRoute && <Drawer/);
  assert.match(frontLayout, /pt: \{ xs: '60px', md: `\$\{headerHeight\}px` \}/);
});

test('restored public header keeps the signed-out login branch as valid JSX', () => {
  assert.match(frontLayout, /\{currentUser \? \([\s\S]*?Dashboard[\s\S]*?\) : \([\s\S]*?Log in[\s\S]*?\)\}/);
  assert.doesNotMatch(frontLayout, /\) : null\}/);
});
