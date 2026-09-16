import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';

const root = process.cwd();
const apiFile = path.join(root, 'src/app/services/api.ts');
const appFile = path.join(root, 'server/src/app.js');
const apiSource = fs.readFileSync(apiFile, 'utf8');
const apiAst = ts.createSourceFile(apiFile, apiSource, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);

function methodFromInit(node) {
  if (!node || !ts.isObjectLiteralExpression(node)) return 'GET';
  for (const property of node.properties) {
    if (!ts.isPropertyAssignment(property) || property.name.getText(apiAst) !== 'method') continue;
    if (ts.isStringLiteral(property.initializer)) return property.initializer.text.toUpperCase();
  }
  return 'GET';
}

function templatePath(node, sourceFile, { apiBasePrefix = false } = {}) {
  if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) return node.text;
  if (!ts.isTemplateExpression(node)) return null;

  let output = node.head.text;
  let start = 0;
  if (apiBasePrefix) {
    const first = node.templateSpans[0];
    if (!first || first.expression.getText(sourceFile) !== 'API_BASE') return null;
    output = first.literal.text;
    start = 1;
  }

  for (let index = start; index < node.templateSpans.length; index += 1) {
    const span = node.templateSpans[index];
    const expressionText = span.expression.getText(sourceFile);
    const isQuerySuffix = ts.isConditionalExpression(span.expression) || ['qs', 'query'].includes(expressionText);
    if (!isQuerySuffix) output += ':param';
    output += span.literal.text;
  }
  return output;
}

function normalizeClientPath(value) {
  if (!value || !value.startsWith('/')) return null;
  const pathOnly = value.split('?')[0].replace(/\/+$/, '') || '/';
  return pathOnly.replace(/:param(?=[A-Za-z0-9_-])/g, ':param/');
}

const clientContracts = [];
function addClient(method, route, location) {
  const normalized = normalizeClientPath(route);
  if (normalized) clientContracts.push({ method, route: normalized, location });
}

function visitClient(node) {
  if (ts.isCallExpression(node)) {
    const expression = node.expression.getText(apiAst);
    if (expression === 'request') {
      const route = node.arguments[0] ? templatePath(node.arguments[0], apiAst) : null;
      addClient(methodFromInit(node.arguments[1]), route, apiAst.getLineAndCharacterOfPosition(node.getStart()).line + 1);
    } else if (expression === 'fetch') {
      const route = node.arguments[0] ? templatePath(node.arguments[0], apiAst, { apiBasePrefix: true }) : null;
      addClient(methodFromInit(node.arguments[1]), route, apiAst.getLineAndCharacterOfPosition(node.getStart()).line + 1);
    } else if (expression.endsWith('.open') && node.arguments.length >= 2 && ts.isStringLiteral(node.arguments[0])) {
      const route = templatePath(node.arguments[1], apiAst, { apiBasePrefix: true });
      addClient(node.arguments[0].text.toUpperCase(), route, apiAst.getLineAndCharacterOfPosition(node.getStart()).line + 1);
    }
  }
  if (ts.isReturnStatement(node) && node.expression && ts.isTemplateExpression(node.expression)) {
    const route = templatePath(node.expression, apiAst, { apiBasePrefix: true });
    if (route) addClient('GET', route, apiAst.getLineAndCharacterOfPosition(node.getStart()).line + 1);
  }
  ts.forEachChild(node, visitClient);
}
visitClient(apiAst);

const appSource = fs.readFileSync(appFile, 'utf8');
const imports = new Map([...appSource.matchAll(/import\s+(\w+)\s+from\s+'\.\/routes\/([^']+)'/g)].map((match) => [match[1], match[2]]));
const mounts = [...appSource.matchAll(/app\.use\('([^']+)',\s*(\w+)\)/g)]
  .map((match) => ({ base: match[1], variable: match[2], file: imports.get(match[2]) }))
  .filter((mount) => mount.base.startsWith('/api/v1/') && mount.file);

const serverContracts = [];
for (const mount of mounts) {
  const routeFile = path.join(root, 'server/src/routes', mount.file);
  const source = fs.readFileSync(routeFile, 'utf8');
  const ast = ts.createSourceFile(routeFile, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
  function visitServer(node) {
    if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression) && node.expression.expression.getText(ast) === 'router') {
      const method = node.expression.name.text.toUpperCase();
      if (!['GET', 'POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) return ts.forEachChild(node, visitServer);
      const routeNode = node.arguments[0];
      if (routeNode && ts.isStringLiteral(routeNode)) {
        const relative = routeNode.text === '/' ? '' : routeNode.text;
        serverContracts.push({ method, route: `${mount.base}${relative}`.replace(/\/+$/, '') || '/', file: mount.file });
      }
    }
    ts.forEachChild(node, visitServer);
  }
  visitServer(ast);
}

function segmentMatch(serverSegment, clientSegment) {
  return serverSegment.startsWith(':') || clientSegment.startsWith(':') || serverSegment === clientSegment;
}
function routeMatches(serverRoute, clientRoute) {
  const server = serverRoute.split('/').filter(Boolean);
  const client = clientRoute.split('/').filter(Boolean);
  return server.length === client.length && server.every((segment, index) => segmentMatch(segment, client[index]));
}

const uniqueClientContracts = [...new Map(clientContracts.map((contract) => [`${contract.method} ${contract.route}`, contract])).values()];
const missing = uniqueClientContracts.filter((client) => !serverContracts.some((server) => server.method === client.method && routeMatches(server.route, `/api/v1${client.route}`)));

if (missing.length) {
  console.error('Client/server API route contract verification failed:');
  for (const contract of missing) console.error(`- api.ts:${contract.location} ${contract.method} ${contract.route}`);
  process.exit(1);
}

console.log(`API route contracts passed for ${uniqueClientContracts.length} client endpoints across ${mounts.length} mounted route groups.`);
