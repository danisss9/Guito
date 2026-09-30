import {
  resolveClaudeCommand,
  runClaudeCli,
  type AiReviewConfig,
  type AiReviewModelRunner,
} from './ai-review.js';

/**
 * One-shot commit message drafting.
 *
 * The pending changes are handed to the Claude Code CLI running on this
 * machine (Claude Haiku by default: a subject line is cheap), and the reply
 * fills the working panel's message box. Nothing is committed — the user
 * still reviews and edits the text before pressing the commit button.
 */

/** Alias handed to `--model`; '' would leave the choice to Claude Code. */
export const DEFAULT_COMMIT_MESSAGE_MODEL = 'haiku';

/** A message draft is a small question; it must not outstay the review budget. */
const COMMIT_MESSAGE_TIMEOUT_SECONDS = 120;

/** Haiku does not need the whole diff budget the reviewer configures. */
const COMMIT_MESSAGE_MAX_DIFF_CHARS = 100000;

/** One file's parsed diff, as produced by the working-tree snapshot. */
export interface CommitMessageFile {
  path: string;
  oldPath: string;
  status: string;
  lines: { type: 'add' | 'del' | 'context' | 'hunk'; text: string }[];
}

/** What the endpoint returns and the message box is filled with. */
export interface CommitMessageResult {
  subject: string;
  description: string;
  /** Which changes the message was drafted from. */
  scope: 'staged' | 'working';
  /** Model alias or id the CLI was told to use. */
  model: string;
}

const oneLine = (value: unknown): string =>
  String(value ?? '')
    .replace(/\s+/g, ' ')
    .trim();

/** Renders one file's diff compactly; only +/- markers, no line numbers. */
function renderFile(file: CommitMessageFile, budget: number): string {
  const renamed =
    file.oldPath && file.oldPath !== file.path ? ` (renamed from ${file.oldPath})` : '';
  const header = `--- ${file.path}${renamed} [${file.status}] ---`;
  if (file.status === 'binary' || !file.lines.length) return `${header}\n(binary or empty diff)`;
  const rows: string[] = [header];
  let used = header.length;
  let truncated = false;
  for (const line of file.lines) {
    const row =
      line.type === 'add'
        ? `+${line.text}`
        : line.type === 'del'
          ? `-${line.text}`
          : ` ${line.text}`;
    if (used + row.length + 1 > budget) {
      truncated = true;
      break;
    }
    rows.push(row);
    used += row.length + 1;
  }
  if (truncated) rows.push('(diff truncated: file too large)');
  return rows.join('\n');
}

const COMMIT_MESSAGE_CONTRACT = `Reply with one JSON object and nothing else:
{"subject": "<one line, imperative mood, at most 72 characters, no trailing period>",
 "description": "<body explaining what and why, wrapped at 72 characters; \\"\\" when the subject alone is clear>"}

Rules:
- Summarize the change as a whole; do not walk through the diff file by file.
- Match the language and style of the recent commit subjects when they are given.
- Do not invent ticket numbers, prefixes or attribution the diff does not show.
- Answer only from the diff below. Do not use tools and do not ask questions.`;

/** Builds the drafting prompt for the pending changes. */
export function buildCommitMessagePrompt(input: {
  branch: string;
  scope: 'staged' | 'working';
  files: CommitMessageFile[];
  recentSubjects: string[];
  maxDiffChars: number;
}): string {
  const perFile = Math.max(2000, Math.floor(input.maxDiffChars / Math.max(input.files.length, 1)));
  const body = input.files.map((file) => renderFile(file, perFile)).join('\n');
  const sections = [
    'You are writing the commit message for changes in a Git repository.',
    '',
    input.branch ? `Branch: ${input.branch}` : '',
    input.scope === 'staged'
      ? 'The diff below is exactly what is staged for the next commit.'
      : 'Nothing is staged yet; the diff below is every uncommitted change, staged or not.',
    input.recentSubjects.length
      ? 'RECENT COMMIT SUBJECTS (match their language and style):\n' +
        input.recentSubjects.map((subject) => `  - ${subject}`).join('\n')
      : '',
    '',
    COMMIT_MESSAGE_CONTRACT,
    '',
    'DIFF',
    '====',
    body || '(no changes)',
  ];
  return sections.filter((section) => section !== '').join('\n');
}

/** Unwraps `--output-format json` and tolerates a fenced or plain-text reply. */
export function parseCommitMessage(raw: string): { subject: string; description: string } {
  let text = raw.trim();
  if (!text) throw new Error('Claude Code returned an empty response.');
  try {
    const envelope = JSON.parse(text);
    if (envelope && typeof envelope === 'object' && !Array.isArray(envelope)) {
      if (envelope.is_error === true) {
        throw new Error(String(envelope.result ?? 'Claude Code reported an error.'));
      }
      if (typeof envelope.result === 'string') text = envelope.result.trim();
    }
  } catch (error: any) {
    // Not the CLI envelope; fall through and read the text as the message.
    if (error?.message?.startsWith('Claude Code')) throw error;
  }
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenced) text = fenced[1].trim();
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start !== -1 && end > start) {
    try {
      const message = JSON.parse(text.slice(start, end + 1));
      const subject = oneLine(message?.subject);
      if (subject) return { subject, description: String(message?.description ?? '').trim() };
    } catch {
      // Malformed JSON; fall through and read the text as the message.
    }
  }
  // Plain text: the first line is the subject, the rest is the description.
  const [first, ...rest] = text.split('\n');
  const subject = oneLine(first);
  if (!subject) {
    throw new Error(`Claude Code did not return a commit message: ${text.slice(0, 300)}`);
  }
  return { subject, description: rest.join('\n').trim() };
}

/** Drafts a commit message by running the Claude Code CLI over the changes. */
export async function generateCommitMessage(options: {
  branch: string;
  scope: 'staged' | 'working';
  files: CommitMessageFile[];
  recentSubjects: string[];
  /** Shares the reviewer's claudePath/timeout/diff-budget/model settings. */
  config: Pick<
    AiReviewConfig,
    'claudePath' | 'commitMessageModel' | 'timeoutSeconds' | 'maxDiffChars'
  >;
  /** Model alias or id; empty uses the configured one, then the haiku default. */
  model?: string;
  cwd: string;
  runModel?: AiReviewModelRunner;
  log?(line: string): void;
}): Promise<CommitMessageResult> {
  const model =
    options.model?.trim() ||
    options.config.commitMessageModel.trim() ||
    DEFAULT_COMMIT_MESSAGE_MODEL;
  const prompt = buildCommitMessagePrompt({
    branch: options.branch,
    scope: options.scope,
    files: options.files,
    recentSubjects: options.recentSubjects,
    maxDiffChars: Math.min(options.config.maxDiffChars, COMMIT_MESSAGE_MAX_DIFF_CHARS),
  });
  const command = await resolveClaudeCommand(options.config.claudePath);
  const args = ['-p', '--output-format', 'json', ...(model ? ['--model', model] : [])];
  options.log?.(`AI commit message: drafting with ${command} (${model})`);
  const runModel = options.runModel ?? runClaudeCli;
  const raw = await runModel(prompt, {
    command,
    args,
    cwd: options.cwd,
    timeoutMs: Math.min(options.config.timeoutSeconds, COMMIT_MESSAGE_TIMEOUT_SECONDS) * 1000,
  });
  const { subject, description } = parseCommitMessage(raw);
  return { subject, description, scope: options.scope, model };
}
