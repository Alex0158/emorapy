#!/usr/bin/env node

import { glob } from 'glob';
import { createRequire } from 'node:module';
import { readFile } from 'node:fs/promises';

const require = createRequire(import.meta.url);
const ts = require('typescript');

const ROOTS = ['frontend/src', 'frontend-admin/src'];
const IGNORE_PATTERNS = [
  '**/*.test.ts',
  '**/*.test.tsx',
  '**/*.spec.ts',
  '**/*.spec.tsx',
  '**/components/ui/**',
  '**/setupTests.ts',
];

const FORM_TAGS = new Set(['input', 'Input', 'textarea', 'Textarea', 'select', 'SelectTrigger']);
const BUTTON_TAGS = new Set(['button', 'Button']);
const SKIPPED_INPUT_TYPES = new Set(['hidden', 'checkbox', 'radio', 'file', 'submit', 'button', 'reset']);
const ACCESSIBLE_NAME_LITERAL_ATTRS = new Set(['aria-label', 'alt']);

const failures = [];

function attrName(attribute) {
  if (!ts.isJsxAttribute(attribute)) return null;
  return attribute.name.getText();
}

function getAttr(opening, name) {
  return opening.attributes.properties.find((attribute) => attrName(attribute) === name) ?? null;
}

function hasAttr(opening, name) {
  return Boolean(getAttr(opening, name));
}

function attrStringValue(attribute) {
  if (!attribute || !ts.isJsxAttribute(attribute) || !attribute.initializer) return null;
  if (ts.isStringLiteral(attribute.initializer)) return attribute.initializer.text;
  return null;
}

function attrSource(attribute, sourceFile) {
  if (!attribute || !ts.isJsxAttribute(attribute) || !attribute.initializer) return null;
  if (ts.isStringLiteral(attribute.initializer)) return attribute.initializer.text;
  return attribute.initializer.getText(sourceFile);
}

function tagName(node) {
  return node.tagName.getText();
}

function lineFor(sourceFile, node) {
  return sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile)).line + 1;
}

function classContainsSrOnly(opening, sourceFile) {
  const className = attrSource(getAttr(opening, 'className'), sourceFile) ?? '';
  return /\bsr-only\b/.test(className);
}

function isHiddenByClass(opening, sourceFile) {
  const className = attrSource(getAttr(opening, 'className'), sourceFile) ?? '';
  return /\bhidden\b/.test(className) || /\bopacity-0\b/.test(className);
}

function hasAccessibleNameAttr(opening) {
  return hasAttr(opening, 'aria-label') || hasAttr(opening, 'aria-labelledby');
}

function expressionCanRenderText(expression) {
  if (!expression) return false;
  if (ts.isParenthesizedExpression(expression)) {
    return expressionCanRenderText(expression.expression);
  }
  if (ts.isStringLiteral(expression) || ts.isNoSubstitutionTemplateLiteral(expression)) {
    return expression.text.trim().length > 0;
  }
  if (
    ts.isTemplateExpression(expression) ||
    ts.isCallExpression(expression) ||
    ts.isIdentifier(expression) ||
    ts.isPropertyAccessExpression(expression) ||
    ts.isElementAccessExpression(expression)
  ) {
    return true;
  }
  if (ts.isConditionalExpression(expression)) {
    return expressionCanRenderText(expression.whenTrue) || expressionCanRenderText(expression.whenFalse);
  }
  if (ts.isBinaryExpression(expression)) {
    return expressionCanRenderText(expression.left) || expressionCanRenderText(expression.right);
  }
  return false;
}

function childrenContainRenderedText(children, sourceFile) {
  return children.some((child) => {
    if (ts.isJsxText(child)) return child.getText(sourceFile).trim().length > 0;
    if (ts.isJsxExpression(child)) return expressionCanRenderText(child.expression);
    if (ts.isJsxElement(child)) {
      const childOpening = child.openingElement;
      if (classContainsSrOnly(childOpening, sourceFile)) return true;
      return childrenContainRenderedText(child.children, sourceFile);
    }
    return false;
  });
}

function childrenContainSrOnly(children, sourceFile) {
  return children.some((child) => {
    if (ts.isJsxElement(child)) {
      return classContainsSrOnly(child.openingElement, sourceFile) || childrenContainSrOnly(child.children, sourceFile);
    }
    return false;
  });
}

function openingOf(node) {
  if (ts.isJsxSelfClosingElement(node)) return node;
  if (ts.isJsxElement(node)) return node.openingElement;
  return null;
}

function gatherLabels(sourceFile) {
  const labelForIds = new Set();

  function visit(node) {
    const opening = openingOf(node);
    if (opening) {
      const name = tagName(opening);
      if (name === 'label' || name === 'Label') {
        const htmlFor = attrStringValue(getAttr(opening, 'htmlFor'));
        if (htmlFor) labelForIds.add(htmlFor);
      }
    }
    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  return labelForIds;
}

function hasWrappingLabel(ancestors) {
  return ancestors.some((ancestor) => {
    const opening = openingOf(ancestor);
    if (!opening) return false;
    const name = tagName(opening);
    return name === 'label' || name === 'Label';
  });
}

function checkButton(file, sourceFile, node) {
  const opening = openingOf(node);
  if (!opening) return;
  const name = tagName(opening);
  if (!BUTTON_TAGS.has(name)) return;
  if (hasAccessibleNameAttr(opening)) return;
  if (!ts.isJsxElement(node)) return;
  if (childrenContainRenderedText(node.children, sourceFile) || childrenContainSrOnly(node.children, sourceFile)) return;

  const size = attrStringValue(getAttr(opening, 'size'));
  const className = attrSource(getAttr(opening, 'className'), sourceFile) ?? '';
  const iconLike = size?.startsWith('icon') || /\bsize-\d+\b|\bp-\d+\b/.test(className) || node.children.length > 0;
  if (!iconLike) return;

  failures.push({
    file,
    line: lineFor(sourceFile, opening),
    message: `${name} appears icon-only and must expose aria-label, aria-labelledby, or sr-only text.`,
  });
}

function checkHardcodedAccessibleName(file, sourceFile, node) {
  const opening = openingOf(node);
  if (!opening) return;

  for (const attribute of opening.attributes.properties) {
    const name = attrName(attribute);
    if (!name || !ACCESSIBLE_NAME_LITERAL_ATTRS.has(name)) continue;

    const value = attrStringValue(attribute);
    if (value === null || value.trim().length === 0) continue;

    failures.push({
      file,
      line: lineFor(sourceFile, attribute),
      message: `${name} must use an i18n expression or runtime value, not a hardcoded string literal.`,
    });
  }
}

function checkFormControl(file, sourceFile, node, ancestors, labelForIds) {
  const opening = openingOf(node);
  if (!opening) return;
  const name = tagName(opening);
  if (!FORM_TAGS.has(name)) return;

  const type = (attrStringValue(getAttr(opening, 'type')) ?? 'text').toLowerCase();
  if (name !== 'SelectTrigger' && SKIPPED_INPUT_TYPES.has(type)) {
    if (type === 'file' && isHiddenByClass(opening, sourceFile)) return;
    if (type !== 'file') return;
  }

  const id = attrStringValue(getAttr(opening, 'id'));
  const hasProgrammaticLabel = hasAccessibleNameAttr(opening) || (id ? labelForIds.has(id) : false) || hasWrappingLabel(ancestors);
  if (!hasProgrammaticLabel) {
    failures.push({
      file,
      line: lineFor(sourceFile, opening),
      message: `${name} must have a programmatic label; placeholder text is not enough.`,
    });
  }

  const needsAutocomplete = name === 'input' || name === 'Input' || name === 'textarea' || name === 'Textarea';
  if (needsAutocomplete && !hasAttr(opening, 'autoComplete')) {
    failures.push({
      file,
      line: lineFor(sourceFile, opening),
      message: `${name} must explicitly set autoComplete for privacy/browser-fill behavior.`,
    });
  }
}

async function checkFile(file) {
  const text = await readFile(file, 'utf8');
  const sourceFile = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const labelForIds = gatherLabels(sourceFile);

  function visit(node, ancestors = []) {
    if (ts.isJsxElement(node) || ts.isJsxSelfClosingElement(node)) {
      checkHardcodedAccessibleName(file, sourceFile, node);
      checkButton(file, sourceFile, node);
      checkFormControl(file, sourceFile, node, ancestors, labelForIds);
    }
    ts.forEachChild(node, (child) => visit(child, [...ancestors, node]));
  }

  visit(sourceFile);
}

const files = (
  await glob(ROOTS.map((root) => `${root}/**/*.{ts,tsx}`), {
    ignore: IGNORE_PATTERNS,
    nodir: true,
  })
).sort();

await Promise.all(files.map(checkFile));

if (failures.length > 0) {
  console.error('Web accessibility contract check failed:');
  for (const failure of failures) {
    console.error(`- ${failure.file}:${failure.line} ${failure.message}`);
  }
  process.exit(1);
}

console.log(`Web accessibility contract check passed (${files.length} files scanned).`);
