import assert from 'node:assert/strict';
import test from 'node:test';
import {
  filterThreads,
  friendlyComment,
  isSystemComment,
  snippetForThread,
  statusLabel,
  threadStatusCounts,
  voteLabel,
} from '../src/app/utils/thread-comments.ts';

const userComment = (content, commentType = 'text') => ({
  commentType,
  content,
});

test('translates vote status changes into friendly activity text', () => {
  assert.deepEqual(friendlyComment(userComment('Drs changed status to 10', 'system')), {
    text: 'Drs approved',
    isSystem: true,
    raw: 'Drs changed status to 10',
  });
  assert.deepEqual(friendlyComment(userComment('Drs changed status to 5', 'system')), {
    text: 'Drs approved with suggestions',
    isSystem: true,
    raw: 'Drs changed status to 5',
  });
  assert.deepEqual(friendlyComment(userComment('Drs changed status to -5', 'system')), {
    text: 'Drs is waiting for the author',
    isSystem: true,
    raw: 'Drs changed status to -5',
  });
  assert.deepEqual(friendlyComment(userComment('Drs changed status to -10', 'system')), {
    text: 'Drs rejected',
    isSystem: true,
    raw: 'Drs changed status to -10',
  });
});

test('translates named status changes and keeps unknown values visible', () => {
  assert.equal(
    friendlyComment(userComment('Drs changed status to fixed', 'system')).text,
    'Drs changed status to Resolved',
  );
  const unknown = friendlyComment(userComment('Drs changed status to 42', 'system'));
  assert.equal(unknown.text, 'Drs changed status to 42');
  assert.equal(unknown.isSystem, true);
});

test('leaves user-written comments untouched', () => {
  const comment = userComment('Please change this');
  assert.equal(isSystemComment(comment), false);
  assert.deepEqual(friendlyComment(comment), {
    text: 'Please change this',
    isSystem: false,
    raw: 'Please change this',
  });
});

test('detects system entries from content when the type is missing', () => {
  assert.equal(isSystemComment(userComment('Drs changed status to 10', 'unknown')), true);
  assert.equal(isSystemComment(userComment('Just a note', 'unknown')), false);
});

test('labels statuses and votes with raw fallbacks', () => {
  assert.equal(statusLabel('fixed'), 'Resolved');
  assert.equal(statusLabel('mystery'), 'mystery');
  assert.equal(voteLabel(10), 'Approved');
  assert.equal(voteLabel(999), '999');
});

const thread = (overrides) => ({
  status: 'active',
  filePath: null,
  comments: [userComment('hello')],
  ...overrides,
});

test('filters threads by status, location, and entry kind', () => {
  const threads = [
    { ...thread({}), id: 1 },
    { ...thread({ status: 'fixed', filePath: 'src/a.ts' }), id: 2 },
    {
      ...thread({
        status: 'fixed',
        comments: [userComment('Drs changed status to 10', 'system')],
      }),
      id: 3,
    },
  ];
  assert.deepEqual(
    filterThreads(threads, { status: 'all', location: 'all', kind: 'all' }),
    threads,
  );
  assert.deepEqual(
    filterThreads(threads, { status: 'fixed', location: 'all', kind: 'all' }).map((t) => t.id),
    [2, 3],
  );
  assert.deepEqual(
    filterThreads(threads, { status: 'all', location: 'inline', kind: 'all' }).map((t) => t.id),
    [2],
  );
  assert.deepEqual(
    filterThreads(threads, { status: 'all', location: 'general', kind: 'all' }).map((t) => t.id),
    [1, 3],
  );
  assert.deepEqual(
    filterThreads(threads, { status: 'all', location: 'all', kind: 'system' }).map((t) => t.id),
    [3],
  );
  assert.deepEqual(
    filterThreads(threads, { status: 'all', location: 'all', kind: 'user' }).map((t) => t.id),
    [1, 2],
  );
});

test('counts thread statuses for the filter bar', () => {
  assert.deepEqual(threadStatusCounts([thread({}), thread({ status: 'fixed' })]), [
    { value: 'active', label: 'Active', count: 1 },
    { value: 'fixed', label: 'Resolved', count: 1 },
  ]);
});

test('slices a focused snippet around the thread anchor line', () => {
  const diff = {
    lines: [
      { type: 'context', oldLine: 9, newLine: 9, text: 'nine' },
      { type: 'context', oldLine: 10, newLine: 10, text: 'ten' },
      { type: 'add', newLine: 11, text: 'eleven' },
      { type: 'context', oldLine: 11, newLine: 12, text: 'twelve' },
    ],
  };
  const snippet = snippetForThread(diff, { line: 11, side: 'right' }, 1);
  assert.deepEqual(
    snippet.map((line) => line.text),
    ['ten', 'eleven', 'twelve'],
  );
  assert.deepEqual(snippetForThread(diff, { line: 99, side: 'right' }), []);
  assert.deepEqual(snippetForThread(null, { line: 11, side: 'right' }), []);
});
