import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { homedir } from 'node:os';
import { join } from 'node:path';
const SEVERITIES = ['blocker', 'concern', 'suggestion', 'nit'];
export const DEFAULT_AI_REVIEW_CONFIG = {
    enabled: false,
    scope: 'reviewer',
    pollMinutes: 5,
    includeDrafts: false,
    claudePath: '',
    claudeArgs: [],
    timeoutSeconds: 600,
    maxDiffChars: 300000,
    instructions: '',
};
/** Normalizes a partial config (settings file or VS Code) onto the defaults. */
export function resolveAiReviewConfig(...sources) {
    const config = { ...DEFAULT_AI_REVIEW_CONFIG };
    for (const source of sources) {
        if (!source)
            continue;
        if (typeof source.enabled === 'boolean')
            config.enabled = source.enabled;
        if (source.scope === 'reviewer' || source.scope === 'mine' || source.scope === 'all') {
            config.scope = source.scope;
        }
        if (Number.isFinite(source.pollMinutes)) {
            config.pollMinutes = Math.min(Math.max(Number(source.pollMinutes), 1), 240);
        }
        if (typeof source.includeDrafts === 'boolean')
            config.includeDrafts = source.includeDrafts;
        if (typeof source.claudePath === 'string' && source.claudePath.trim()) {
            config.claudePath = source.claudePath.trim();
        }
        if (Array.isArray(source.claudeArgs)) {
            config.claudeArgs = source.claudeArgs.map((arg) => String(arg)).filter(Boolean);
        }
        if (Number.isFinite(source.timeoutSeconds)) {
            config.timeoutSeconds = Math.min(Math.max(Number(source.timeoutSeconds), 30), 3600);
        }
        if (Number.isFinite(source.maxDiffChars)) {
            config.maxDiffChars = Math.min(Math.max(Number(source.maxDiffChars), 2000), 2000000);
        }
        if (typeof source.instructions === 'string')
            config.instructions = source.instructions;
    }
    return config;
}
/** Locations npm and the standalone installer put the CLI in. */
function claudeCandidates() {
    const home = homedir();
    const candidates = [
        join(home, '.claude', 'local', 'claude'),
        join(home, '.local', 'bin', 'claude'),
    ];
    if (process.platform === 'win32') {
        const appData = process.env.APPDATA;
        if (appData)
            candidates.push(join(appData, 'npm', 'claude.cmd'));
        candidates.push(join(home, '.local', 'bin', 'claude.exe'));
    }
    return candidates;
}
/** Descending version order, so an upgraded extension wins without a setting. */
function compareVersions(left, right) {
    for (let index = 0; index < Math.max(left.length, right.length); index++) {
        const difference = (right[index] ?? 0) - (left[index] ?? 0);
        if (difference)
            return difference;
    }
    return 0;
}
/**
 * The Claude Code VS Code extension ships its own CLI under a version-stamped
 * folder that is on no PATH. That is the usual install for anyone running
 * Claude Code in VS Code, which is exactly who this feature is for, so the
 * extension folders are searched before giving up on PATH. The -server folders
 * cover Remote SSH, Dev Containers and Codespaces.
 */
async function bundledClaudeCandidates() {
    const { readdir } = await import('node:fs/promises');
    const home = homedir();
    const binary = process.platform === 'win32' ? 'claude.exe' : 'claude';
    const found = [];
    for (const root of [
        '.vscode',
        '.vscode-insiders',
        '.vscode-server',
        '.vscode-server-insiders',
    ]) {
        const extensions = join(home, root, 'extensions');
        let entries;
        try {
            entries = await readdir(extensions);
        }
        catch {
            continue;
        }
        for (const entry of entries) {
            if (!entry.startsWith('anthropic.claude-code-'))
                continue;
            const version = (entry.match(/(\d+)\.(\d+)\.(\d+)/)?.slice(1) ?? []).map(Number);
            found.push({
                path: join(extensions, entry, 'resources', 'native-binary', binary),
                version,
            });
        }
    }
    return found
        .sort((left, right) => compareVersions(left.version, right.version))
        .map((entry) => entry.path);
}
/** Resolves the executable to spawn: the setting, then the usual install paths. */
export async function resolveClaudeCommand(configured) {
    if (configured.trim())
        return configured.trim();
    const { access } = await import('node:fs/promises');
    const candidates = [...claudeCandidates(), ...(await bundledClaudeCandidates())];
    for (const candidate of candidates) {
        try {
            await access(candidate);
            return candidate;
        }
        catch {
            // Try the next known location.
        }
    }
    // Fall back to PATH; the spawn error names the missing executable.
    return process.platform === 'win32' ? 'claude.cmd' : 'claude';
}
/**
 * Runs the Claude Code CLI in print mode. The prompt goes over stdin because a
 * pull request diff is far larger than the Windows command line allows.
 */
const runClaudeCli = (prompt, { command, args, cwd, timeoutMs }) => new Promise((resolve, reject) => {
    const child = spawn(command, args, {
        cwd,
        windowsHide: true,
        // .cmd shims on Windows are not executables and need the shell.
        shell: process.platform === 'win32' && /\.(cmd|bat)$/i.test(command),
    });
    let stdout = '';
    let stderr = '';
    let settled = false;
    const finish = (error) => {
        if (settled)
            return;
        settled = true;
        clearTimeout(timer);
        if (error)
            reject(error);
        else
            resolve(stdout);
    };
    const timer = setTimeout(() => {
        child.kill();
        finish(new Error(`The review timed out after ${Math.round(timeoutMs / 1000)}s.`));
    }, timeoutMs);
    child.stdout.on('data', (chunk) => {
        stdout += String(chunk);
    });
    child.stderr.on('data', (chunk) => {
        stderr += String(chunk);
    });
    child.on('error', (error) => {
        finish(new Error(error.code === 'ENOENT'
            ? `Claude Code was not found at "${command}". Install it, or set guito.aiReview.claudePath.`
            : `Claude Code could not be started: ${error.message}`));
    });
    child.on('close', (code) => {
        if (code === 0)
            return finish(null);
        const detail = stderr.trim() || stdout.trim();
        finish(new Error(`Claude Code exited with code ${code}${detail ? `: ${detail}` : '.'}`));
    });
    child.stdin.on('error', () => {
        // A CLI that exits early closes stdin; the close handler reports why.
    });
    child.stdin.end(prompt);
});
/** Unwraps `--output-format json` and tolerates a fenced or chatty reply. */
export function parseModelReview(raw) {
    let text = raw.trim();
    if (!text)
        throw new Error('Claude Code returned an empty response.');
    try {
        const envelope = JSON.parse(text);
        if (envelope && typeof envelope === 'object' && !Array.isArray(envelope)) {
            if (envelope.is_error === true) {
                throw new Error(String(envelope.result ?? 'Claude Code reported an error.'));
            }
            if (typeof envelope.result === 'string')
                text = envelope.result.trim();
            else if (Array.isArray(envelope.findings)) {
                return {
                    summary: String(envelope.summary ?? ''),
                    findings: envelope.findings,
                };
            }
        }
    }
    catch (error) {
        // Not the CLI envelope; fall through and read the text as the review.
        if (error?.message?.startsWith('Claude Code'))
            throw error;
    }
    const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (fenced)
        text = fenced[1].trim();
    const start = text.indexOf('{');
    const end = text.lastIndexOf('}');
    if (start === -1 || end <= start) {
        throw new Error(`Claude Code did not return a JSON review: ${text.slice(0, 300)}`);
    }
    let review;
    try {
        review = JSON.parse(text.slice(start, end + 1));
    }
    catch {
        throw new Error(`Claude Code returned malformed JSON: ${text.slice(start, start + 300)}`);
    }
    return {
        summary: String(review?.summary ?? ''),
        findings: Array.isArray(review?.findings) ? review.findings : [],
    };
}
/** Identity of a finding across re-reviews: same place, same point. */
function fingerprint(file, title) {
    const normalized = title
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, ' ')
        .trim();
    return createHash('sha1').update(`${file}\u0000${normalized}`).digest('hex').slice(0, 16);
}
/** Renders one file's diff with the line numbers the model must cite. */
function renderFileDiff(diff, budget) {
    const header = `--- FILE: ${diff.path}${diff.oldPath && diff.oldPath !== diff.path ? ` (renamed from ${diff.oldPath})` : ''} [${diff.status}] ---`;
    if (diff.binary)
        return `${header}\n(binary file, not reviewable)\n`;
    const rows = [header];
    let used = header.length;
    let truncated = false;
    for (const line of diff.lines) {
        let row;
        if (line.type === 'hunk')
            row = `        ${line.text}`;
        else if (line.type === 'add')
            row = `${String(line.newLine ?? '').padStart(6)} + ${line.text}`;
        else if (line.type === 'del')
            row = `${''.padStart(6)} - ${line.text}`;
        else
            row = `${String(line.newLine ?? '').padStart(6)}   ${line.text}`;
        if (used + row.length > budget) {
            truncated = true;
            break;
        }
        rows.push(row);
        used += row.length + 1;
    }
    if (truncated)
        rows.push('        (diff truncated: file too large to review in full)');
    return `${rows.join('\n')}\n`;
}
/** Existing discussion, so the model neither repeats it nor talks past it. */
function renderThreads(threads) {
    const relevant = threads.filter((thread) => thread.comments.length);
    if (!relevant.length)
        return 'None.';
    return relevant
        .map((thread) => {
        const where = thread.filePath
            ? `${thread.filePath}${thread.line ? `:${thread.line}` : ''}`
            : 'pull request';
        const body = thread.comments
            .map((comment) => `    ${comment.author.name}: ${comment.content.replace(/\s+/g, ' ')}`)
            .join('\n');
        return `  [${thread.status}] ${where}\n${body}`;
    })
        .join('\n');
}
const REVIEW_CONTRACT = `Reply with one JSON object and nothing else:
{"summary": "<one or two sentences on the change as a whole>",
 "findings": [
   {"file": "<path exactly as given in the diff header, or \\"\\" for the change as a whole>",
    "line": <the right-hand line number shown in the diff, or null>,
    "endLine": <last line of the range, or null>,
    "severity": "blocker" | "concern" | "suggestion" | "nit",
    "title": "<a short stable label, reused verbatim if you raise this point again later>",
    "comment": "<the review comment, in markdown, addressed to the author>"}
 ]}

Rules:
- Only cite a line number that appears as an added or context line in that file's diff. Never guess.
- Report problems you can justify from the diff: bugs, broken edge cases, security holes,
  data loss, race conditions, API misuse, missing error handling, tests that do not test
  what they claim. Also flag clear violations of the surrounding code's conventions.
- Do not comment on formatting a formatter handles, do not restate what the code does,
  and do not ask for changes the diff already makes.
- An empty findings array is the right answer for a clean change. Say so in the summary.
- Answer only from the diff below. Do not use tools and do not ask questions.`;
/** Builds the review prompt for one pass over one pull request. */
export function buildReviewPrompt(input) {
    const { pullRequest, diffs, threads, previous, sinceCommit } = input;
    const incremental = Boolean(sinceCommit);
    const perFile = Math.max(2000, Math.floor(input.maxDiffChars / Math.max(diffs.length, 1)));
    const body = diffs.map((diff) => renderFileDiff(diff, perFile)).join('\n');
    const raised = previous.filter((finding) => finding.status !== 'dismissed');
    const dismissed = previous.filter((finding) => finding.status === 'dismissed');
    const sections = [
        'You are reviewing an Azure DevOps pull request as a careful senior engineer on this team.',
        '',
        `PULL REQUEST #${pullRequest.id}: ${pullRequest.title}`,
        `Author: ${pullRequest.author}`,
        `Merging ${pullRequest.sourceBranch} into ${pullRequest.targetBranch}`,
        pullRequest.description ? `\nDescription:\n${pullRequest.description}` : '',
        '',
        incremental
            ? `THIS IS A FOLLOW-UP REVIEW. You already reviewed this pull request at commit ${sinceCommit.slice(0, 8)}.\n` +
                `The diff below covers the files touched since then, at the current commit ${pullRequest.sourceCommit.slice(0, 8)}.\n` +
                'Review the new work. Raise a point you made before only if the new code makes it worse\n' +
                'or the author changed it incorrectly; reuse the same title when you do.'
            : `This is the first review, at commit ${pullRequest.sourceCommit.slice(0, 8)}.`,
        '',
        'POINTS YOU ALREADY RAISED (do not repeat these):',
        raised.length
            ? raised
                .map((finding) => `  - [${finding.severity}] ${finding.file || 'pull request'}${finding.line ? `:${finding.line}` : ''} — ${finding.title}`)
                .join('\n')
            : '  None.',
        '',
        'POINTS THE USER DISMISSED (never raise these again):',
        dismissed.length
            ? dismissed
                .map((finding) => `  - ${finding.file || 'pull request'} — ${finding.title}`)
                .join('\n')
            : '  None.',
        '',
        'EXISTING COMMENT THREADS ON THE PULL REQUEST:',
        renderThreads(threads),
        '',
        input.skipped.length
            ? `NOT SHOWN (binary or unreviewable): ${input.skipped.join(', ')}\n`
            : '',
        input.instructions.trim() ? `TEAM INSTRUCTIONS:\n${input.instructions.trim()}\n` : '',
        REVIEW_CONTRACT,
        '',
        'DIFF',
        '====',
        body || '(no reviewable changes)',
    ];
    return sections.filter((section) => section !== '').join('\n');
}
const emptyState = (pullRequestId, title = '') => ({
    pullRequestId,
    title,
    reviewedCommit: '',
    reviewedAt: '',
    passes: 0,
    status: 'idle',
    error: '',
    summary: '',
    findings: [],
});
export function createAiReviewer(deps, initialConfig = DEFAULT_AI_REVIEW_CONFIG, repositoryPath = process.cwd()) {
    let config = initialConfig;
    const runModel = deps.runModel ?? runClaudeCli;
    const now = deps.now ?? (() => new Date());
    const log = deps.log ?? (() => { });
    const listeners = new Set();
    const running = new Set();
    let timer;
    let activePoll = null;
    // One review at a time: each one spawns a CLI and burns Azure DevOps calls.
    let queue = Promise.resolve();
    const serialize = (action) => {
        const result = queue.then(action);
        queue = result.catch(() => { });
        return result;
    };
    // Store writes are read-modify-write, so they are serialized too.
    let storeQueue = Promise.resolve();
    const mutateStore = (action) => {
        const result = storeQueue.then(async () => {
            const store = await deps.readStore();
            if (!store.pullRequests)
                store.pullRequests = {};
            const value = await action(store);
            await deps.writeStore(store);
            return value;
        });
        storeQueue = result.catch(() => { });
        return result;
    };
    const stateOf = async (pullRequestId) => {
        const store = await deps.readStore();
        return store.pullRequests?.[String(pullRequestId)] ?? null;
    };
    /** Turns the model's reply into findings, dropping repeats and bad anchors. */
    const normalizeFindings = (raw, known, diffs, commit) => {
        const anchors = new Map();
        for (const diff of diffs) {
            const lines = new Set();
            for (const line of diff.lines) {
                if (typeof line.newLine === 'number')
                    lines.add(line.newLine);
            }
            anchors.set(diff.path, lines);
        }
        const seen = new Set(known.map((finding) => finding.id));
        const accepted = [];
        for (const entry of raw) {
            const title = String(entry?.title ?? '').trim();
            const comment = String(entry?.comment ?? '').trim();
            if (!title || !comment)
                continue;
            const file = String(entry?.file ?? '')
                .trim()
                .replace(/^\//, '');
            // A path the diff never mentioned cannot be anchored; post it PR-level.
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
            // Identity follows the file the model named, not where the comment can
            // be anchored: a point raised again for a file the follow-up diff no
            // longer shows is still the same point.
            const id = fingerprint(file, title);
            if (seen.has(id))
                continue;
            seen.add(id);
            accepted.push({
                id,
                file: inDiff ? file : '',
                line,
                endLine,
                severity,
                title,
                comment,
                commit,
                status: 'pending',
                createdAt: now().toISOString(),
            });
        }
        return accepted.sort((a, b) => SEVERITIES.indexOf(a.severity) - SEVERITIES.indexOf(b.severity));
    };
    const runReview = async (pullRequestId, options = {}) => {
        const pullRequest = await deps.loadPullRequest(pullRequestId);
        const previousState = (await stateOf(pullRequestId)) ?? emptyState(pullRequestId);
        if (!options.force &&
            previousState.reviewedCommit &&
            previousState.reviewedCommit === pullRequest.sourceCommit) {
            return previousState;
        }
        running.add(pullRequestId);
        await mutateStore((store) => {
            store.pullRequests[String(pullRequestId)] = {
                ...previousState,
                title: pullRequest.title,
                status: 'running',
                error: '',
            };
        });
        try {
            // A re-review looks only at what changed since the last reviewed commit.
            const sinceCommit = !options.force && previousState.reviewedCommit !== pullRequest.sourceCommit
                ? previousState.reviewedCommit
                : '';
            const changes = await deps.loadChanges(pullRequestId, sinceCommit || undefined);
            const [threads, diffs] = await Promise.all([
                deps.loadThreads(pullRequestId),
                Promise.all(changes.map((file) => deps.loadFileDiff(pullRequestId, file))),
            ]);
            const reviewable = diffs.filter((diff) => !diff.binary && diff.lines.length);
            const skipped = diffs
                .filter((diff) => diff.binary || !diff.lines.length)
                .map((diff) => diff.path);
            let summary = '';
            let accepted = [];
            if (reviewable.length) {
                const prompt = buildReviewPrompt({
                    pullRequest,
                    diffs: reviewable,
                    threads,
                    previous: previousState.findings,
                    sinceCommit,
                    skipped,
                    maxDiffChars: config.maxDiffChars,
                    instructions: config.instructions,
                });
                const command = await resolveClaudeCommand(config.claudePath);
                const args = [
                    '-p',
                    '--output-format',
                    'json',
                    ...(config.claudeArgs.length ? config.claudeArgs : []),
                ];
                log(`AI review: reviewing pull request ${pullRequestId} with ${command}`);
                const raw = await runModel(prompt, {
                    command,
                    args,
                    cwd: repositoryPath,
                    timeoutMs: config.timeoutSeconds * 1000,
                });
                const review = parseModelReview(raw);
                summary = review.summary;
                accepted = normalizeFindings(review.findings, previousState.findings, reviewable, pullRequest.sourceCommit);
            }
            else {
                summary = 'No reviewable text changes in this pull request.';
            }
            const next = await mutateStore((store) => {
                const current = store.pullRequests[String(pullRequestId)] ?? previousState;
                const state = {
                    ...current,
                    title: pullRequest.title,
                    reviewedCommit: pullRequest.sourceCommit,
                    reviewedAt: now().toISOString(),
                    passes: current.passes + 1,
                    status: 'idle',
                    error: '',
                    summary,
                    findings: [...current.findings, ...accepted],
                };
                store.pullRequests[String(pullRequestId)] = state;
                return state;
            });
            log(`AI review: pull request ${pullRequestId} produced ${accepted.length} new finding(s).`);
            if (accepted.length) {
                for (const listener of listeners)
                    listener(next);
            }
            return next;
        }
        catch (error) {
            const message = error?.message ? String(error.message) : String(error);
            log(`AI review: pull request ${pullRequestId} failed: ${message}`);
            return mutateStore((store) => {
                const current = store.pullRequests[String(pullRequestId)] ?? previousState;
                const state = {
                    ...current,
                    status: 'error',
                    error: message,
                    errorCommit: pullRequest.sourceCommit,
                };
                store.pullRequests[String(pullRequestId)] = state;
                return state;
            });
        }
        finally {
            running.delete(pullRequestId);
        }
    };
    /** One pass over the pull requests in scope; reviews those with new code. */
    const runPoll = async () => {
        const reviewed = [];
        try {
            const pullRequests = (await deps.listPullRequests()).filter(wanted);
            const store = await deps.readStore();
            for (const pullRequest of pullRequests) {
                if (!pullRequest.sourceCommit)
                    continue;
                const state = store.pullRequests?.[String(pullRequest.id)];
                // Already reviewed at this commit, or already failed at it: a broken
                // setup must not spin, so the retry waits for the next commit.
                if (state?.reviewedCommit === pullRequest.sourceCommit)
                    continue;
                if (state?.status === 'error' && state.errorCommit === pullRequest.sourceCommit)
                    continue;
                const next = await serialize(() => runReview(pullRequest.id));
                if (next.status !== 'error')
                    reviewed.push(pullRequest.id);
            }
        }
        catch (error) {
            log(`AI review: poll failed: ${error?.message ?? error}`);
        }
        return reviewed;
    };
    const wanted = (pullRequest) => {
        if (pullRequest.isDraft && !config.includeDrafts)
            return false;
        if (config.scope === 'all')
            return true;
        if (config.scope === 'mine')
            return pullRequest.isMine;
        return pullRequest.isReviewer;
    };
    const reviewer = {
        updateConfig(next) {
            const wasEnabled = config.enabled;
            const interval = config.pollMinutes;
            config = next;
            if (!next.enabled)
                reviewer.stop();
            else if (!wasEnabled || interval !== next.pollMinutes)
                reviewer.start();
        },
        config: () => config,
        state: stateOf,
        async overview() {
            const store = await deps.readStore();
            const pullRequests = Object.values(store.pullRequests ?? {}).map((state) => ({
                pullRequestId: state.pullRequestId,
                title: state.title,
                status: running.has(state.pullRequestId) ? 'running' : state.status,
                pending: state.findings.filter((finding) => finding.status === 'pending').length,
                reviewedCommit: state.reviewedCommit,
                reviewedAt: state.reviewedAt,
            }));
            return { enabled: config.enabled, running: running.size, pullRequests };
        },
        review: (pullRequestId, options) => serialize(() => runReview(pullRequestId, options)),
        async post(pullRequestId, findingIds) {
            const state = await stateOf(pullRequestId);
            if (!state)
                throw new Error(`Pull request ${pullRequestId} has not been reviewed yet.`);
            const wanted = new Set(findingIds);
            const posting = state.findings.filter((finding) => finding.status === 'pending' && wanted.has(finding.id));
            if (!posting.length)
                throw new Error('No pending findings were selected.');
            const posted = new Map();
            for (const finding of posting) {
                // Azure only anchors a thread to a file when it also has a line, so a
                // file-level finding names its file in the comment instead of losing it.
                const anchored = Boolean(finding.file && finding.line);
                const where = !anchored && finding.file ? ` · \`${finding.file}\`` : '';
                const header = `**${finding.severity}** · ${finding.title}${where}`;
                const result = await deps.postComment(pullRequestId, {
                    content: `${header}\n\n${finding.comment}`,
                    filePath: anchored ? finding.file : undefined,
                    line: finding.line ?? undefined,
                    endLine: finding.endLine ?? undefined,
                });
                posted.set(finding.id, result.threadId);
            }
            return mutateStore((store) => {
                const current = store.pullRequests[String(pullRequestId)] ?? state;
                const next = {
                    ...current,
                    findings: current.findings.map((finding) => posted.has(finding.id)
                        ? {
                            ...finding,
                            status: 'posted',
                            threadId: posted.get(finding.id),
                            resolvedAt: now().toISOString(),
                        }
                        : finding),
                };
                store.pullRequests[String(pullRequestId)] = next;
                return next;
            });
        },
        async dismiss(pullRequestId, findingIds) {
            const wanted = new Set(findingIds);
            return mutateStore((store) => {
                const current = store.pullRequests[String(pullRequestId)];
                if (!current)
                    throw new Error(`Pull request ${pullRequestId} has not been reviewed yet.`);
                const next = {
                    ...current,
                    findings: current.findings.map((finding) => finding.status === 'pending' && wanted.has(finding.id)
                        ? { ...finding, status: 'dismissed', resolvedAt: now().toISOString() }
                        : finding),
                };
                store.pullRequests[String(pullRequestId)] = next;
                return next;
            });
        },
        async forget(pullRequestId) {
            await mutateStore((store) => {
                delete store.pullRequests[String(pullRequestId)];
            });
        },
        poll() {
            if (!config.enabled)
                return Promise.resolve([]);
            // A caller asking for a poll while one runs waits for that pass rather
            // than being told, misleadingly, that there was nothing to review.
            activePoll ?? (activePoll = runPoll().finally(() => {
                activePoll = null;
            }));
            return activePoll;
        },
        start() {
            reviewer.stop();
            if (!config.enabled)
                return;
            timer = setInterval(() => void reviewer.poll(), config.pollMinutes * 60000);
            timer.unref?.();
        },
        stop() {
            if (timer)
                clearInterval(timer);
            timer = undefined;
        },
        onFindings(listener) {
            listeners.add(listener);
            return () => listeners.delete(listener);
        },
    };
    return reviewer;
}
