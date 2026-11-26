import { test } from 'node:test';
import assert from 'node:assert/strict';
import { safeImageUrl } from '../recipes/url.ts';

test('https public host ok', () => assert.equal(safeImageUrl('https://scontent.cdninstagram.com/v/x.jpg?a=1'), 'https://scontent.cdninstagram.com/v/x.jpg?a=1'));
test('http refused', () => assert.equal(safeImageUrl('http://example.com/x.jpg'), null));
test('IP literals refused', () => {
  assert.equal(safeImageUrl('https://169.254.169.254/latest'), null);
  assert.equal(safeImageUrl('https://10.0.0.1/x.jpg'), null);
  assert.equal(safeImageUrl('https://[::1]/x.jpg'), null);
});
test('local names refused', () => {
  assert.equal(safeImageUrl('https://localhost/x.jpg'), null);
  assert.equal(safeImageUrl('https://printer.local/x.jpg'), null);
  assert.equal(safeImageUrl('https://db.internal/x.jpg'), null);
  assert.equal(safeImageUrl('https://intranet/x.jpg'), null);
});
test('credentials and odd ports refused', () => {
  assert.equal(safeImageUrl('https://u:p@example.com/x.jpg'), null);
  assert.equal(safeImageUrl('https://example.com:8443/x.jpg'), null);
});
test('garbage refused', () => assert.equal(safeImageUrl('not a url'), null));
