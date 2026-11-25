// Parse the original game script and work out, for every top-level name, where it is
// declared and every line that reads or writes it. Used by tools/split/split.mjs to give
// each module exactly the imports it needs, and to find writes that would break once a
// name is imported (imported bindings are read-only).
import { parse } from 'acorn';
import { analyze as scopeAnalyze } from 'eslint-scope';
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

export const ROOT = resolve(import.meta.dirname, '..', '..');

/** The original game script (the second inline <script>), exactly as in the original file. */
export function originalScript() {
  const html = readFileSync(join(ROOT, 'original', 'Stranded-100-Days-PC.html'), 'utf8');
  const s = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)];
  return s[1][1];
}

/**
 * Returns
 *   lines:      the script split on '\n' (lines[i] is line i+1)
 *   decls:      Map name -> { line, kind }   top-level declarations (const/let/function/class)
 *   refs:       [{ name, line, write, init }] every reference to a top-level name
 *   statements: [{ from, to, names }]        top-level statements with their line span
 */
export function analyzeScript(text) {
  const ast = parse(text, { ecmaVersion: 'latest', sourceType: 'script', locations: true, ranges: true });
  const sm = scopeAnalyze(ast, { ecmaVersion: 2022, sourceType: 'script' });
  const g = sm.globalScope;
  const decls = new Map();
  for (const v of g.variables) {
    const d = v.defs[0];
    if (!d) continue;
    decls.set(v.name, { line: d.name.loc.start.line, kind: d.type === 'FunctionName' ? 'function' : d.parent && d.parent.kind || d.type });
  }
  const refs = [];
  for (const v of g.variables) for (const r of v.references) {
    refs.push({ name: v.name, line: r.identifier.loc.start.line, write: r.isWrite(), init: !!r.init });
  }
  const statements = ast.body.map(n => {
    const names = [];
    if (n.type === 'VariableDeclaration') for (const d of n.declarations) collectIds(d.id, names);
    else if ((n.type === 'FunctionDeclaration' || n.type === 'ClassDeclaration') && n.id) names.push(n.id.name);
    return { from: n.loc.start.line, to: n.loc.end.line, names, type: n.type };
  });
  const globalRefs = g.through.map(r => ({ name: r.identifier.name, line: r.identifier.loc.start.line }));
  return { lines: text.split('\n'), decls, refs, statements, through: globalRefs.map(r => r.name), globalRefs };
}
function collectIds(p, out) {
  if (!p) return;
  if (p.type === 'Identifier') out.push(p.name);
  else if (p.type === 'ObjectPattern') p.properties.forEach(q => collectIds(q.value || q.argument, out));
  else if (p.type === 'ArrayPattern') p.elements.forEach(e => collectIds(e, out));
  else if (p.type === 'RestElement') collectIds(p.argument, out);
  else if (p.type === 'AssignmentPattern') collectIds(p.left, out);
}
