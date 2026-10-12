import { readFile, writeFile } from 'node:fs/promises';
import { REVIEW_CONTRACT, SEVERITIES, effortArgs, fingerprint, parseModelReview, renderFileDiff, resolveClaudeCommand, runClaudeCli, } from './ai-review.js';
/** Thrown when a review or fix is already running. */
export class WorkingReviewBusyError extends Error {
}
/** Tools the fixer may use: read and edit files, nothing else. */
const FIX_TOOLS = 'Read,Edit,Write,Glob,Grep';
export const emptyWorkingReview = () => ({
    status: 'idle',
    startedAt: '',
    finishedAt: '',
    branch: '',
    model: '',
    effort: '',
    files: [],
    summary: '',
    error: '',
    findings: [],
    fixingId: '',
});
/** Builds the prompt for one review of the uncommitted changes. */
export function buildWorkingReviewPrompt(input) {
    const perFile = Math.max(2000, Math.floor(input.maxDiffChars / Math.max(input.diffs.length, 1)));
    const body = input.diffs.map((diff) => renderFileDiff(diff, perFile)).join('\n');
    const sections = [
        'You are reviewing uncommitted changes in a Git repository as a careful senior engineer,',
        'before the author commits them. The diff compares the working tree with HEAD.',
        '',
        input.branch ? `Branch: ${input.branch}` : '',
        input.skipped.length ? `NOT SHOWN (binary or unreviewable): ${input.skipped.join(', ')}\n` : '',
        input.instructions.trim() ? `TEAM INSTRUCTIONS:\n${input.instructions.trim()}\n` : '',
        REVIEW_CONTRACT,
        '',
        'DIFF',
        '====',
        body || '(no reviewable changes)',
    ];
    return sections.filter((section) => section !== '').join('\n');
}
/** Builds the prompt that asks Claude Code to fix one finding in place. */
export function buildFixPrompt(finding) {
    const where = finding.file
        ? `${finding.file}${finding.line ? `, line ${finding.line}${finding.endLine && finding.endLine !== finding.line ? `-${finding.endLine}` : ''}` : ''}`
        : 'the uncommitted changes as a whole';
    return [
        'A code review of the uncommitted changes in this Git repository (the current directory)',
        'found the problem below. Fix it.',
        '',
        `WHERE: ${where}`,
        `SEVERITY: ${finding.severity}`,
        `PROBLEM: ${finding.title}`,
        'DETAILS:',
        finding.comment,
        '',
        'Rules:',
        '- Fix only this problem, with the smallest change that does it, in the style of the surrounding code.',
        '- Read a file before editing it. Only read and edit files: do not run commands, do not use git, do not commit.',
        '- If the problem is not real or cannot be fixed safely, change nothing and say why.',
        '- When you are done, reply with one or two sentences saying what you changed.',
    ].join('\n');
}
/** Claude Code's closing message from a `--output-format json` run. */
export function parseFixReply(raw) {
    let text = raw.trim();
    try {
        const envelope = JSON.parse(text);
        if (envelope && typeof envelope === 'object' && !Array.isArray(envelope)) {
            if (envelope.is_error === true) {
                throw new Error(String(envelope.result ?? 'Claude Code reported an error.'));
            }
            if (typeof envelope.result === 'string')
                text = envelope.result.trim();
        }
    }
    catch (error) {
        // Not the CLI envelope; the text is the reply.
        if (!(error instanceof SyntaxError))
            throw error;
    }
    return text.slice(0, 2000) || 'Claude Code finished without a summary.';
}
/** Turns the model's reply into findings, dropping repeats and bad anchors. */
function normalizeFindings(raw, diffs) {
    const anchors = new Map();
    for (const diff of diffs) {
        const lines = new Set();
        for (const line of diff.lines) {
            if (typeof line.newLine === 'number')
                lines.add(line.newLine);
        }
        anchors.set(diff.path, lines);
    }
    const seen = new Set();
    const accepted = [];
    for (const entry of raw) {
        const title = String(entry?.title ?? '').trim();
        const comment = String(entry?.comment ?? '').trim();
        if (!title || !comment)
            continue;
        const file = String(entry?.file ?? '')
            .trim()
            .replace(/^\//, '');
        const inDiff = anchors.has(file);
        const rawLine = Number(entry?.line);
        const line = inDiff && Number.isInteger(rawLine) && anchors.get(file).has(rawLine) ? rawLine : null;
        const rawEnd = Number(entry?.endLine);
        const endLine = line !== null && Number.isInteger(rawEnd) && rawEnd >= line && anchors.get(file).has(rawEnd)
            ? rawEnd
            : null;
        const severity = SEVERITIES.includes(entry?.severity)
            ? entry.severity
            : 'concern';
        const id = fingerprint(file, title);
        if (seen.has(id))
            continue;
        seen.add(id);
        accepted.push({ id, file: inDiff ? file : '', line, endLine, severity, title, comment });
    }
    return accepted.sort((a, b) => SEVERITIES.indexOf(a.severity) - SEVERITIES.indexOf(b.severity));
}
export function createWorkingReviewer(deps) {
    const runModel = deps.runModel ?? runClaudeCli;
    const now = deps.now ?? (() => new Date());
    const log = deps.log ?? (() => { });
    const listeners = new Set();
    /** The review or fix in progress here; null when idle. */
    let live = null;
    let reviewAbort;
    let fixAbort;
    const readStore = async () => {
        try {
            const stored = JSON.parse(await readFile(deps.storePath, 'utf8'));
            return { ...emptyWorkingReview(), ...stored, fixingId: '' };
        }
        catch {
            return emptyWorkingReview();
        }
    };
    const writeStore = async (state) => {
        // A run in progress is never stored: it would outlive a server that dies mid-run.
        await writeFile(deps.storePath, JSON.stringify({ ...state, fixingId: '' }, null, 2));
    };
    const publish = (state) => {
        for (const listener of listeners) {
            try {
                listener(state);
            }
            catch {
                // A failing listener must not break the run.
            }
        }
    };
    const claim = (state) => {
        if (live)
            throw new WorkingReviewBusyError('A code review or fix is already running.');
        live = state;
        publish(state);
    };
    const settle = async (state) => {
        try {
            await writeStore(state);
        }
        finally {
            live = null;
            publish(state);
        }
        return state;
    };
    const beginReview = async (options = {}) => {
        if (live)
            throw new WorkingReviewBusyError('A code review or fix is already running.');
        const config = await deps.config();
        const model = options.model?.trim() || config.model;
        const effort = options.effort ?? config.effort;
        const running = {
            ...emptyWorkingReview(),
            status: 'running',
            startedAt: now().toISOString(),
            model,
            effort,
        };
        claim(running);
        const abort = new AbortController();
        reviewAbort = abort;
        const finished = (async () => {
            try {
                const { branch, diffs } = await deps.loadChanges();
                const reviewable = diffs.filter((diff) => !diff.binary && diff.lines.length);
                const skipped = diffs
                    .filter((diff) => diff.binary || !diff.lines.length)
                    .map((diff) => diff.path);
                live = { ...running, branch, files: diffs.map((diff) => diff.path) };
                if (!diffs.length)
                    throw new Error('There are no uncommitted changes to review.');
                if (!reviewable.length)
                    throw new Error('None of the uncommitted changes can be reviewed.');
                const prompt = buildWorkingReviewPrompt({
                    branch,
                    diffs: reviewable,
                    skipped,
                    maxDiffChars: config.maxDiffChars,
                    instructions: config.instructions,
                });
                const command = await resolveClaudeCommand(config.claudePath);
                if (abort.signal.aborted)
                    throw new Error('The review was cancelled.');
                const args = [
                    '-p',
                    // Reviews should not show up in the user's Claude Code session history.
                    '--no-session-persistence',
                    '--output-format',
                    'json',
                    ...(model ? ['--model', model] : []),
                    ...effortArgs(effort),
                ];
                log(`Code review: reviewing ${reviewable.length} uncommitted file(s) with ${command}${model ? ` (${model})` : ''}${effort ? `, ${effort} effort` : ''}`);
                const raw = await runModel(prompt, {
                    command,
                    args,
                    cwd: deps.cwd,
                    timeoutMs: config.timeoutSeconds * 1000,
                    signal: abort.signal,
                });
                const review = parseModelReview(raw);
                return await settle({
                    ...live,
                    status: 'done',
                    finishedAt: now().toISOString(),
                    summary: review.summary,
                    findings: normalizeFindings(review.findings, reviewable),
                });
            }
            catch (error) {
                const cancelled = abort.signal.aborted;
                log(`Code review: ${cancelled ? 'cancelled' : `failed: ${error?.message ?? error}`}`);
                return await settle({
                    ...(live ?? running),
                    status: cancelled ? 'cancelled' : 'error',
                    finishedAt: now().toISOString(),
                    error: cancelled ? '' : String(error?.message ?? error),
                });
            }
            finally {
                if (reviewAbort === abort)
                    reviewAbort = undefined;
            }
        })();
        return { running, finished };
    };
    const beginFix = async (findingId) => {
        if (live)
            throw new WorkingReviewBusyError('A code review or fix is already running.');
        const [stored, config] = await Promise.all([readStore(), deps.config()]);
        const finding = stored.findings.find((entry) => entry.id === findingId);
        if (stored.status !== 'done' || !finding) {
            throw new Error('That finding is no longer part of the code review.');
        }
        const withFix = (fixState, fixingId) => ({
            ...stored,
            fixingId,
            findings: stored.findings.map((entry) => entry.id === findingId ? { ...entry, fix: fixState } : entry),
        });
        const running = withFix({ status: 'running', summary: '', error: '' }, findingId);
        claim(running);
        const abort = new AbortController();
        fixAbort = abort;
        const finished = (async () => {
            try {
                const command = await resolveClaudeCommand(config.claudePath);
                if (abort.signal.aborted)
                    throw new Error('The fix was cancelled.');
                const args = [
                    '-p',
                    '--no-session-persistence',
                    '--output-format',
                    'json',
                    ...(stored.model ? ['--model', stored.model] : []),
                    ...effortArgs(stored.effort),
                    // Edits are applied without asking; any other tool is refused in print mode.
                    '--permission-mode',
                    'acceptEdits',
                    '--allowedTools',
                    FIX_TOOLS,
                ];
                log(`Code review: fixing "${finding.title}" with ${command}`);
                const raw = await runModel(buildFixPrompt(finding), {
                    command,
                    args,
                    cwd: deps.cwd,
                    timeoutMs: config.timeoutSeconds * 1000,
                    signal: abort.signal,
                });
                return await settle(withFix({ status: 'fixed', summary: parseFixReply(raw), error: '' }, ''));
            }
            catch (error) {
                const message = abort.signal.aborted
                    ? 'The fix was stopped. Claude Code may already have changed some files.'
                    : String(error?.message ?? error);
                log(`Code review: fix of "${finding.title}" failed: ${message}`);
                return await settle(withFix({ status: 'error', summary: '', error: message }, ''));
            }
            finally {
                if (fixAbort === abort)
                    fixAbort = undefined;
            }
        })();
        return { running, finished };
    };
    /** Starts a run and returns its first state; the rest is reported through onChange. */
    const detach = async (started) => {
        const { running, finished } = await started;
        finished.catch(() => { });
        return running;
    };
    return {
        state: async () => live ?? (await readStore()),
        run: async (options) => (await beginReview(options)).finished,
        start: (options) => detach(beginReview(options)),
        cancel: () => reviewAbort?.abort(),
        fix: async (findingId) => (await beginFix(findingId)).finished,
        startFix: (findingId) => detach(beginFix(findingId)),
        cancelFix: () => fixAbort?.abort(),
        busy: () => live !== null,
        onChange: (listener) => {
            listeners.add(listener);
            return () => listeners.delete(listener);
        },
    };
}
