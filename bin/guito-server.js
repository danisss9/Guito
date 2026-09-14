import { existsSync } from "node:fs";
import { execFile, spawn } from "node:child_process";
import { readFile, rm, writeFile } from "node:fs/promises";
import { randomBytes } from "node:crypto";
import { userInfo } from "node:os";
import { basename, isAbsolute, join, relative, resolve, sep } from "node:path";
import fastify from "fastify";
import fastifyStatic from "@fastify/static";
import fastifyCors from "@fastify/cors";
import fastifyCompress from "@fastify/compress";
import { simpleGit } from "simple-git";
import { createTwoFilesPatch } from "diff";
import { promisify } from "node:util";
import { workingTree } from "./working-tree.js";
import { avatarCache } from "./avatars.js";
import { repositoryState } from "./repository-state.js";
const execFileAsync = promisify(execFile);
const AZURE_API_VERSION = "5.0-preview";
export const DEFAULT_PR_BRANCH_NAME_TEMPLATE = "pr/${randomstring}";
const PR_BRANCH_TEMPLATE_VARIABLES = [
    "username",
    "randomstring",
    "branch",
    "targetbranch",
    "title",
    "repository",
    "date",
    "time",
    "timestamp",
];
/** Azure DevOps comment thread statuses, by their numeric REST value. */
const AZURE_THREAD_STATUSES = {
    unknown: 0,
    active: 1,
    wontFix: 3,
    fixed: 4,
    closed: 5,
    byDesign: 6,
    pending: 7,
};
const azureThreadStatusName = (value) => Object.entries(AZURE_THREAD_STATUSES).find(([, numeric]) => numeric === value)?.[0] ?? "unknown";
/** Pull request reviewer votes, by their numeric REST value. */
const AZURE_VOTES = {
    reset: 0,
    approveWithSuggestions: 5,
    approve: 10,
    waitForAuthor: -5,
    reject: -10,
};
/**
 * Extracts {projectPath, repo} from an Azure DevOps git remote URL.
 * Supports https (with optional credentials) and ssh (scp-style and ssh://)
 * forms, a trailing .git, and URL-encoded segments such as %20.
 */
export function parseAzureRemoteUrl(remoteUrl) {
    const value = (remoteUrl ?? "").trim();
    if (!value) {
        return null;
    }
    let path;
    const urlMatch = value.match(/^[a-z][a-z0-9+.\-]*:\/\/[^/]*\/(.*)$/i);
    if (urlMatch) {
        path = urlMatch[1];
    }
    else {
        // scp-style ssh: git@host:Collection/Project/_git/Repo(.git)
        const scpMatch = value.match(/^[^@/]+@[^:]+:(.+)$/);
        if (!scpMatch) {
            return null;
        }
        path = scpMatch[1];
    }
    path = path.replace(/\.git\/?$/i, "");
    try {
        path = decodeURIComponent(path);
    }
    catch {
        // Keep the raw path when it contains invalid percent-escapes.
    }
    const gitIndex = path.toLowerCase().lastIndexOf("/_git/");
    if (gitIndex < 0) {
        return null;
    }
    const projectPath = path.slice(0, gitIndex).replace(/^\/+|\/+$/g, "");
    const repo = path.slice(gitIndex + "/_git/".length).replace(/^\/+|\/+$/g, "");
    if (!projectPath || !repo) {
        return null;
    }
    return { projectPath, repo };
}
/**
 * Builds the encoded "{origin}[/{collection}]/{project}" prefix for Azure
 * DevOps REST calls. When the base URL already contains the collection
 * prefix of the remote path it is not duplicated.
 */
export function buildAzureProjectPrefix(baseUrl, remoteUrl) {
    const base = (baseUrl ?? "").trim().replace(/\/+$/, "");
    if (!base) {
        return null;
    }
    const info = parseAzureRemoteUrl(remoteUrl);
    if (!info) {
        return null;
    }
    const encodePath = (value) => value
        .split("/")
        .filter(Boolean)
        .map((segment) => encodeURIComponent(segment))
        .join("/");
    try {
        const parsed = new URL(base);
        const decode = (path) => path
            .split("/")
            .filter(Boolean)
            .map((segment) => decodeURIComponent(segment));
        const baseParts = decode(parsed.pathname);
        const remoteParts = info.projectPath.split("/").filter(Boolean);
        let overlap = Math.min(baseParts.length, remoteParts.length);
        while (overlap &&
            !baseParts
                .slice(-overlap)
                .every((part, index) => part.toLowerCase() === remoteParts[index].toLowerCase()))
            overlap--;
        return `${parsed.origin}/${[...baseParts, ...remoteParts.slice(overlap)].map(encodeURIComponent).join("/")}`;
    }
    catch {
        return `${base}/${encodePath(info.projectPath)}`;
    }
}
/** Builds the pullrequests REST URL from the server base URL and origin remote. */
export function buildAzurePullRequestUrl(baseUrl, remoteUrl) {
    const prefix = buildAzureProjectPrefix(baseUrl, remoteUrl);
    if (!prefix) {
        return null;
    }
    const info = parseAzureRemoteUrl(remoteUrl);
    if (!info) {
        return null;
    }
    return `${prefix}/_apis/git/repositories/${encodeURIComponent(info.repo)}/pullrequests?api-version=${AZURE_API_VERSION}`;
}
/**
 * Default Azure DevOps HTTP runner: shells out to the Windows built-in
 * curl.exe with Negotiate and an empty username, which authenticates with
 * the current Windows session (SSPI single sign-on). Do not also request
 * --ntlm: some curl builds omit that option while still supporting Negotiate.
 */
function defaultAzureRequest(method, url, body, contentType = "application/json") {
    return new Promise((resolveRequest, rejectRequest) => {
        const args = [
            "-sS",
            "--negotiate",
            "-u",
            ":",
            "--max-time",
            "60",
            "-w",
            "\n%{http_code}",
            "-X",
            method,
        ];
        if (method === "POST" || method === "PUT" || method === "PATCH") {
            args.push("-H", `Content-Type: ${contentType}`, "--data-binary", "@-");
        }
        args.push(url);
        const child = spawn("curl.exe", args, { windowsHide: true });
        let stdout = "";
        let stderr = "";
        child.stdout.on("data", (chunk) => {
            stdout += chunk;
        });
        child.stderr.on("data", (chunk) => {
            stderr += chunk;
        });
        // EPIPE when curl exits before reading the whole body; the close handler
        // reports the real failure.
        child.stdin.on("error", () => { });
        child.on("error", (err) => {
            rejectRequest(new Error(`Failed to run curl.exe (Windows integrated auth requires Windows): ${err.message}`));
        });
        child.on("close", (code) => {
            if (code !== 0) {
                rejectRequest(new Error(stderr.trim() || `curl.exe exited with code ${code}.`));
                return;
            }
            // -w appends "\n<http_code>" after the response body.
            const separator = stdout.lastIndexOf("\n");
            const status = Number.parseInt(stdout.slice(separator + 1), 10);
            if (separator < 0 || !Number.isFinite(status)) {
                rejectRequest(new Error("Unexpected curl.exe output (missing HTTP status)."));
                return;
            }
            resolveRequest({ status, body: stdout.slice(0, separator) });
        });
        child.stdin.end(body, "utf8");
    });
}
const randomBranchSuffix = () => {
    const alphabet = "abcdefghijklmnopqrstuvwxyz0123456789";
    const bytes = randomBytes(6);
    let suffix = "";
    for (const byte of bytes) {
        suffix += alphabet[byte % alphabet.length];
    }
    return suffix;
};
const safeBranchTemplateValue = (value) => value
    .trim()
    .replace(/[\x00-\x20\x7f~^:?*\[\\]+/g, "-")
    .replace(/\.{2,}/g, "-")
    .replace(/-+/g, "-")
    .replace(/^[./-]+|[./-]+$/g, "") || "unknown";
/** Expands a configured automatic PR branch name and rejects unknown variables. */
export const formatPrBranchName = (template, values) => {
    const source = template.trim() || DEFAULT_PR_BRANCH_NAME_TEMPLATE;
    return source.replace(/\$\{([^}]+)\}/g, (_match, variable) => {
        if (!PR_BRANCH_TEMPLATE_VARIABLES.includes(variable)) {
            throw new Error(`Unknown pull request branch variable \${${variable}}. Supported variables: ${PR_BRANCH_TEMPLATE_VARIABLES.map((name) => `\${${name}}`).join(", ")}.`);
        }
        return safeBranchTemplateValue(values[variable]);
    });
};
/** Extracts Azure DevOps' human-readable error message from a REST response. */
const azureErrorMessage = (result) => {
    try {
        return String(JSON.parse(result.body)?.message ?? "");
    }
    catch {
        return result.body;
    }
};
export async function startGuitoServer({ repositoryPath, uiRoot, host, port = 8080, apiToken, azureDevOpsUrl, prBranchNameTemplate, autoReload, diffViewer, showGraph, showStashes, showTags, showRemoteBranches, issueRegex, issueUrl, allowMerge, fileListView, searchMode, searchCaseSensitive, azureRequestImpl, avatarFetchImpl, onLog, }) {
    // Initialize server
    const app = fastify({
        logger: false,
    });
    if (onLog) {
        // Report error responses to the host (e.g. the VS Code output channel).
        app.addHook("onSend", async (request, reply, payload) => {
            if (reply.statusCode >= 400) {
                const body = typeof payload === "string" ? payload.slice(0, 500) : "";
                onLog(`${request.method} ${request.url} -> ${reply.statusCode}${body ? ` ${body}` : ""}`);
            }
            return payload;
        });
    }
    // Register cors
    await app.register(fastifyCors);
    // Compress JSON responses (commit history payloads are highly repetitive)
    await app.register(fastifyCompress);
    if (apiToken) {
        app.addHook("onRequest", async (request, reply) => {
            const pathname = request.url.split("?", 1)[0];
            if (!pathname.startsWith("/api/")) {
                return;
            }
            const headerToken = request.headers["x-guito-token"];
            const queryToken = request.query
                ?.guitoToken;
            const archiveToken = pathname === "/api/archive" ? queryToken : undefined;
            if (headerToken !== apiToken && archiveToken !== apiToken) {
                await reply
                    .status(401)
                    .type("application/json")
                    .send({ error: "unauthorized" });
            }
        });
    }
    // Register static file provider (supports both `ui/` and `ui/browser/` layouts)
    const staticRoot = existsSync(join(uiRoot, "browser", "index.html"))
        ? join(uiRoot, "browser")
        : uiRoot;
    if (existsSync(staticRoot)) {
        await app.register(fastifyStatic, { root: staticRoot });
        // Serve UI
        app.get("/", (_req, resp) => resp.sendFile("index.html"));
    }
    else {
        app.get("/", (_req, resp) => resp.send("Guito API is running. Build the UI with `npm run build:ui`."));
    }
    // Initialize git lib
    const git = simpleGit(repositoryPath);
    const avatars = avatarCache(avatarFetchImpl);
    app.get("/api/avatar", async (req, reply) => {
        const email = String(req.query?.email ?? "").trim();
        if (!email || email.length > 320)
            return reply.code(400).send({ error: "Valid email required" });
        const image = await avatars(email);
        reply.header("Cache-Control", "private, max-age=3600");
        return image
            ? reply.type(image.contentType).send(image.data)
            : reply.code(204).send();
    });
    let stateRequest;
    app.get("/api/repository-state", async (_req, reply) => {
        try {
            stateRequest ?? (stateRequest = repositoryState(git, repositoryPath).finally(() => {
                stateRequest = undefined;
            }));
            return await stateRequest;
        }
        catch (err) {
            return reply.code(400).send({ error: err.message });
        }
    });
    // ==================== Diff parsing ====================
    function parseUnifiedDiff(rawDiff) {
        const files = [];
        const lines = rawDiff.split("\n");
        let current = null;
        let inHunk = false;
        let oldLine = 0;
        let newLine = 0;
        const startFile = (line) => {
            current = {
                path: "",
                oldPath: "",
                status: "modified",
                lines: [],
                additions: 0,
                deletions: 0,
            };
            const match = line.match(/^diff --git a\/(.*) b\/(.*)$/);
            if (match) {
                current.oldPath = match[1];
                current.path = match[2];
            }
            inHunk = false;
        };
        for (const line of lines) {
            if (line.startsWith("diff --git ")) {
                if (current)
                    files.push(current);
                startFile(line);
                continue;
            }
            if (!current)
                continue;
            if (line.startsWith("@@")) {
                inHunk = true;
                const match = line.match(/^@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@/);
                if (match) {
                    oldLine = parseInt(match[1], 10);
                    newLine = parseInt(match[2], 10);
                }
                current.lines.push({ type: "hunk", text: line });
                continue;
            }
            if (!inHunk) {
                // File meta headers (mode, index, rename, binary...)
                if (line.startsWith("new file mode"))
                    current.status = "added";
                else if (line.startsWith("deleted file mode"))
                    current.status = "deleted";
                else if (line.startsWith("rename from "))
                    current.status = "renamed";
                else if (line.startsWith("rename to "))
                    current.path = line.slice("rename to ".length);
                else if (line.startsWith("Binary files") ||
                    line.startsWith("GIT binary patch"))
                    current.status = "binary";
                continue;
            }
            if (line.startsWith("\\")) {
                // "\ No newline at end of file"
                continue;
            }
            if (line.startsWith("+")) {
                current.lines.push({
                    type: "add",
                    newLine: newLine++,
                    text: line.slice(1),
                });
                current.additions++;
            }
            else if (line.startsWith("-")) {
                current.lines.push({
                    type: "del",
                    oldLine: oldLine++,
                    text: line.slice(1),
                });
                current.deletions++;
            }
            else {
                current.lines.push({
                    type: "context",
                    oldLine: oldLine++,
                    newLine: newLine++,
                    text: line.slice(1),
                });
            }
        }
        if (current)
            files.push(current);
        return files;
    }
    const working = workingTree(git, parseUnifiedDiff);
    // Keep validation and the corresponding index mutation in one operation.
    let mutationQueue = Promise.resolve();
    const mutate = (action) => {
        const result = mutationQueue.then(action);
        mutationQueue = result.catch(() => { });
        return result;
    };
    const repoRoot = async () => (await git.revparse(["--show-toplevel"])).trim();
    // ==================== Azure DevOps settings ====================
    // Settings live in the repository's git directory so they are per-repo and
    // never committed. The VS Code extension passes its own setting via
    // azureDevOpsUrl, which wins over the file.
    let settingsPath = "";
    try {
        const gitDir = (await git.revparse(["--absolute-git-dir"])).trim();
        settingsPath = join(gitDir, "guito-settings.json");
    }
    catch {
        settingsPath = join(repositoryPath, ".git", "guito-settings.json");
    }
    const readSettings = async () => {
        try {
            return JSON.parse(await readFile(settingsPath, "utf8"));
        }
        catch {
            return {};
        }
    };
    const writeSettings = async (settings) => {
        await writeFile(settingsPath, `${JSON.stringify(settings, null, 2)}\n`, "utf8");
    };
    const azureRequest = azureRequestImpl ?? defaultAzureRequest;
    const effectiveAzureUrl = async () => {
        const configuredAzureUrl = azureDevOpsUrl?.trim() ?? "";
        if (configuredAzureUrl) {
            return { url: configuredAzureUrl, source: "vscode" };
        }
        const settings = await readSettings();
        const url = typeof settings.azureDevOpsUrl === "string"
            ? settings.azureDevOpsUrl.trim()
            : "";
        return { url, source: url ? "file" : "" };
    };
    /** Resolves the Azure DevOps project prefix or throws a user-facing error. */
    const azureProjectContext = async () => {
        const effective = await effectiveAzureUrl();
        if (!effective.url) {
            throw new Error("Azure DevOps URL is not configured. Set it in Settings (gear icon) or the guito.azureDevOpsUrl VS Code setting.");
        }
        let remoteUrl = "";
        try {
            remoteUrl = (await git.remote(["get-url", "origin"])).trim();
        }
        catch {
            throw new Error('No "origin" remote is configured for this repository.');
        }
        const prefix = buildAzureProjectPrefix(effective.url, remoteUrl);
        if (!prefix) {
            throw new Error(`The origin remote does not point to an Azure DevOps project: ${remoteUrl}`);
        }
        return { prefix, remoteUrl };
    };
    /** Human identity of the authenticated Windows/Azure user; cached per run. */
    let cachedAzureMe = null;
    const azureMe = async () => {
        if (cachedAzureMe) {
            return cachedAzureMe;
        }
        const { prefix } = await azureProjectContext();
        // The prefix is "{collection-or-org}/{project}"; connectionData is
        // collection scoped.
        const collection = prefix.slice(0, prefix.lastIndexOf("/"));
        const result = await azureRequest("GET", `${collection}/_apis/connectionData?q=1&api-version=${AZURE_API_VERSION}`, "");
        if (result.status < 200 || result.status >= 300) {
            throw new Error(azureErrorMessage(result) ||
                `Azure DevOps returned HTTP ${result.status} while resolving the current user.`);
        }
        const user = (JSON.parse(result.body) ?? {}).authenticatedUser;
        const id = String(user?.id ?? "");
        if (!id) {
            throw new Error("Azure DevOps did not report an authenticated user.");
        }
        cachedAzureMe = {
            id,
            name: String(user?.providerDisplayName ?? ""),
            email: String(user?.properties?.Mail?.$value ??
                user?.properties?.Account?.$value ??
                ""),
        };
        return cachedAzureMe;
    };
    /** Web UI URL of a pull request, used by the "Open in Azure DevOps" links. */
    const azurePrWebUrl = (prefix, remoteUrl, id) => {
        const repo = parseAzureRemoteUrl(remoteUrl)?.repo ?? "";
        return `${prefix}/_git/${encodeURIComponent(repo)}/pullrequest/${id}`;
    };
    /** Normalizes the Azure pull request merge state for the dialog. */
    const azureMergeStatus = (pr) => {
        const raw = String(pr?.mergeStatus ?? "notSet");
        return [
            "notSet",
            "queued",
            "conflicts",
            "succeeded",
            "rejectedByPolicy",
            "failure",
        ].includes(raw)
            ? raw
            : "notSet";
    };
    /** Maps one Azure DevOps pull request record to the shape the UI consumes. */
    const mapAzurePullRequest = (pr, prefix, remoteUrl, me) => {
        const reviewers = (Array.isArray(pr?.reviewers) ? pr.reviewers : []).map((entry) => ({
            id: String(entry?.id ?? ""),
            name: String(entry?.displayName ?? ""),
            email: String(entry?.uniqueName ?? ""),
            vote: Number(entry?.vote ?? 0),
            isRequired: entry?.isRequired === true,
        }));
        const mine = me
            ? reviewers.find((reviewer) => reviewer.id === me.id)
            : undefined;
        return {
            id: Number(pr?.pullRequestId ?? 0),
            title: String(pr?.title ?? ""),
            isDraft: pr?.isDraft === true,
            author: {
                id: String(pr?.createdBy?.id ?? ""),
                name: String(pr?.createdBy?.displayName ?? ""),
                email: String(pr?.createdBy?.uniqueName ?? ""),
            },
            createdAt: String(pr?.creationDate ?? ""),
            sourceBranch: String(pr?.sourceRefName ?? "").replace(/^refs\/heads\//, ""),
            targetBranch: String(pr?.targetRefName ?? "").replace(/^refs\/heads\//, ""),
            status: String(pr?.status ?? "active"),
            webUrl: String(pr?._links?.web?.href || "") ||
                azurePrWebUrl(prefix, remoteUrl, Number(pr?.pullRequestId ?? 0)),
            reviewers,
            myVote: mine ? Number(mine.vote ?? 0) : 0,
            requiresMe: mine?.isRequired === true,
        };
    };
    /** REST base of one pull request (".../pullrequests/{id}") plus repo context. */
    const azurePrApiBase = async (id) => {
        if (!Number.isInteger(id) || id <= 0) {
            throw new Error("A pull request id is required.");
        }
        const { prefix, remoteUrl } = await azureProjectContext();
        const repo = parseAzureRemoteUrl(remoteUrl)?.repo;
        if (!repo) {
            throw new Error(`The origin remote does not point to an Azure DevOps project: ${remoteUrl}`);
        }
        return {
            prefix,
            remoteUrl,
            repo,
            base: `${prefix}/_apis/git/repositories/${encodeURIComponent(repo)}/pullrequests/${id}`,
        };
    };
    /** Runs one Azure request and turns non-2xx replies into user-facing errors. */
    const azureJson = async (method, url, body = "", contentType = "application/json") => {
        const result = await azureRequest(method, url, body, contentType);
        if (result.status < 200 || result.status >= 300) {
            throw new Error(azureErrorMessage(result) ||
                `Azure DevOps returned HTTP ${result.status}.`);
        }
        return (result.body ? JSON.parse(result.body) : {});
    };
    /** vstfs artifact URI of a pull request; work item ArtifactLink relations point at it. */
    const azurePrArtifactUrl = (projectId, repositoryId, id) => `vstfs:///Git/PullRequestId/${encodeURIComponent(projectId)}%2F${encodeURIComponent(repositoryId)}%2F${id}`;
    /** Reads one work item's relations from the WIT API. */
    const azureWorkItemRelations = async (prefix, workItemId) => {
        const item = await azureJson("GET", `${prefix}/_apis/wit/workitems/${workItemId}?$expand=relations&api-version=${AZURE_API_VERSION}`);
        return Array.isArray(item?.relations) ? item.relations : [];
    };
    /** Patches a work item's relations (the WIT API wants the patch content type). */
    const azurePatchWorkItemRelations = async (prefix, workItemId, patch) => {
        await azureJson("PATCH", `${prefix}/_apis/wit/workitems/${workItemId}?api-version=${AZURE_API_VERSION}`, JSON.stringify(patch), "application/json-patch+json");
    };
    /** Project prefix plus artifact URI of one pull request (work item links). */
    const azurePrArtifactOf = async (id) => {
        const { base, prefix } = await azurePrApiBase(id);
        const pr = await azureJson("GET", `${base}?api-version=${AZURE_API_VERSION}`);
        const projectId = String(pr?.repository?.project?.id ?? "");
        const repositoryId = String(pr?.repository?.id ?? "");
        if (!projectId || !repositoryId) {
            throw new Error("Azure DevOps did not report the pull request's project and repository.");
        }
        return {
            prefix,
            artifactUrl: azurePrArtifactUrl(projectId, repositoryId, id),
        };
    };
    /** Merges the VS Code settings with the server-side settings file. */
    const effectiveSettings = async () => {
        const [file, azure] = await Promise.all([
            readSettings(),
            effectiveAzureUrl(),
        ]);
        const fileAutoReload = typeof file.autoReload === "boolean" ? file.autoReload : undefined;
        const fileShowGraph = typeof file.showGraph === "boolean" ? file.showGraph : undefined;
        const fileShowStashes = typeof file.showStashes === "boolean" ? file.showStashes : undefined;
        const fileShowTags = typeof file.showTags === "boolean" ? file.showTags : undefined;
        const fileShowRemoteBranches = typeof file.showRemoteBranches === "boolean"
            ? file.showRemoteBranches
            : undefined;
        const fileFileListView = file.fileListView === "tree" || file.fileListView === "flat"
            ? file.fileListView
            : undefined;
        const fileSearchMode = file.searchMode === "filter" || file.searchMode === "navigate"
            ? file.searchMode
            : undefined;
        const fileAllowMerge = typeof file.allowMerge === "boolean" ? file.allowMerge : undefined;
        const fileSearchCaseSensitive = typeof file.searchCaseSensitive === "boolean"
            ? file.searchCaseSensitive
            : undefined;
        const filePrBranchNameTemplate = typeof file.prBranchNameTemplate === "string" &&
            file.prBranchNameTemplate.trim()
            ? file.prBranchNameTemplate.trim()
            : undefined;
        const localIssue = file.issueLinking;
        let issueLinking = null;
        if (issueRegex?.trim() && issueUrl?.trim()) {
            issueLinking = {
                regex: issueRegex.trim(),
                url: issueUrl.trim(),
                useGlobally: true,
            };
        }
        else if (typeof localIssue?.regex === "string" &&
            typeof localIssue.url === "string") {
            issueLinking = {
                regex: localIssue.regex,
                url: localIssue.url,
                useGlobally: false,
            };
        }
        else {
            const [regex, url] = await Promise.all([
                git
                    .raw(["config", "--global", "--get", "guito.issueRegex"])
                    .catch(() => ""),
                git
                    .raw(["config", "--global", "--get", "guito.issueUrl"])
                    .catch(() => ""),
            ]);
            if (regex.trim() && url.trim()) {
                issueLinking = {
                    regex: regex.trim(),
                    url: url.trim(),
                    useGlobally: true,
                };
            }
        }
        return {
            azureDevOpsUrl: azure.url,
            prBranchNameTemplate: prBranchNameTemplate?.trim() ||
                filePrBranchNameTemplate ||
                DEFAULT_PR_BRANCH_NAME_TEMPLATE,
            source: azure.source,
            autoReload: typeof autoReload === "boolean" ? autoReload : (fileAutoReload ?? true),
            diffViewer: diffViewer === "vscode" ? "vscode" : "guito",
            showGraph: typeof showGraph === "boolean" ? showGraph : (fileShowGraph ?? true),
            showStashes: typeof showStashes === "boolean"
                ? showStashes
                : (fileShowStashes ?? false),
            showTags: typeof showTags === "boolean" ? showTags : (fileShowTags ?? true),
            showRemoteBranches: typeof showRemoteBranches === "boolean"
                ? showRemoteBranches
                : (fileShowRemoteBranches ?? true),
            fileListView: fileListView ?? fileFileListView ?? "flat",
            searchMode: searchMode ?? fileSearchMode ?? "navigate",
            searchCaseSensitive: typeof searchCaseSensitive === "boolean"
                ? searchCaseSensitive
                : (fileSearchCaseSensitive ?? false),
            allowMerge: typeof allowMerge === "boolean" ? allowMerge : (fileAllowMerge ?? true),
            issueLinking,
        };
    };
    const configuredIdentity = async () => {
        const config = await git.listConfig();
        return {
            name: String(config.all["user.name"] ?? "").trim(),
            email: String(config.all["user.email"] ?? "").trim(),
        };
    };
    const authorIdentity = (name, email, identity) => ({
        author_name: identity.name &&
            identity.email &&
            email.trim().toLowerCase() === identity.email.toLowerCase()
            ? identity.name
            : name,
        author_email: email,
    });
    // ==================== Repository ====================
    app.get("/api/repo", async (_req, resp) => {
        try {
            const root = (await git.revparse(["--show-toplevel"])).trim();
            return resp.type("application/json").send({
                root,
                name: basename(root),
                identity: await configuredIdentity(),
            });
        }
        catch (err) {
            return resp
                .status(400)
                .type("application/json")
                .send({ error: err.message });
        }
    });
    // ==================== Commits ====================
    app.get("/api/commits", async (req, resp) => {
        try {
            const query = (req.query ?? {});
            const limit = Number.parseInt(query.limit ?? "", 10);
            const skip = Number.parseInt(query.skip ?? "", 10);
            // Build simple-git options conditionally: an explicit key with an
            // undefined value would still be emitted as a bare command flag.
            // The commit body is intentionally omitted: it roughly doubles the
            // payload and is only needed when a commit is opened, so it is served
            // on demand by /api/commit/detail instead.
            const options = {
                format: {
                    hash: "%H",
                    date: "%aI",
                    message: "%s",
                    refs: "%D",
                    author_name: "%aN",
                    author_email: "%aE",
                    parents: "%P",
                },
                "--all": null,
            };
            if (Number.isFinite(limit) && limit > 0) {
                options.maxCount = limit;
            }
            if (Number.isFinite(skip) && skip > 0) {
                options["--skip"] = String(skip);
            }
            const [log, count, identity] = await Promise.all([
                git.log(options),
                git.raw(["rev-list", "--count", "--all"]),
                configuredIdentity(),
            ]);
            const commits = log.all.map((commit) => ({
                ...commit,
                ...authorIdentity(commit.author_name, commit.author_email, identity),
                parents: String(commit.parents ?? "")
                    .split(" ")
                    .filter(Boolean),
            }));
            return resp
                .type("application/json")
                .send({ commits, total: Number.parseInt(count, 10) || 0 });
        }
        catch (err) {
            // A repository without any commits has no history to list.
            if (/does not have any commits yet|unknown revision|bad default revision/i.test(err.message ?? "")) {
                return resp.type("application/json").send({ commits: [], total: 0 });
            }
            return resp
                .status(400)
                .type("application/json")
                .send({ error: err.message });
        }
    });
    // Full-text commit search. The list payload omits commit bodies, so body
    // matching runs here (git --grep covers subject and body together) and the
    // client unions the resulting hashes with its local subject/author/hash
    // matches over the loaded history.
    app.get("/api/commits/search", async (req, resp) => {
        const query = String((req.query ?? {}).query ?? "").trim();
        const caseSensitive = String((req.query ?? {}).caseSensitive ?? "") === "1";
        if (!query) {
            return resp.type("application/json").send({ hashes: [], indices: {} });
        }
        try {
            const grepArgs = ["log", "--all"];
            if (!caseSensitive)
                grepArgs.push("-i");
            grepArgs.push("--fixed-strings", `--grep=${query}`, "--format=%H");
            const [raw, history] = await Promise.all([
                git.raw(grepArgs),
                git.raw(["log", "--all", "--format=%H"]),
            ]);
            const hashes = raw
                .split("\n")
                .map((hash) => hash.trim())
                .filter(Boolean);
            const matches = new Set(hashes);
            // Use the same unfiltered Git log order as the paged history endpoint.
            const indices = {};
            history
                .split("\n")
                .map((hash) => hash.trim())
                .filter(Boolean)
                .forEach((hash, index) => {
                if (matches.has(hash))
                    indices[hash] = index;
            });
            return resp.type("application/json").send({
                hashes,
                indices,
            });
        }
        catch (err) {
            if (/does not have any commits yet|unknown revision|bad default revision/i.test(err.message ?? "")) {
                return resp.type("application/json").send({ hashes: [], indices: {} });
            }
            return resp
                .status(400)
                .type("application/json")
                .send({ error: err.message });
        }
    });
    app.post("/api/commit", async (req, resp) => {
        try {
            const { message, description } = req.body ?? {};
            await mutate(() => working.commit(message, description));
            return resp.type("application/json").send({ success: true });
        }
        catch (err) {
            return resp
                .status(400)
                .type("application/json")
                .send({ error: err.message });
        }
    });
    app.post("/api/amend", async (req, resp) => {
        try {
            const { message, description } = req.body;
            await git.commit([message, ...(description ? [description] : [])], {
                "--amend": null,
                "--no-edit": null,
            });
            return resp.type("application/json").send({ success: true });
        }
        catch (err) {
            return resp
                .status(400)
                .type("application/json")
                .send({ error: err.message });
        }
    });
    app.post("/api/revert", async (req, resp) => {
        try {
            const { commit } = req.body;
            await git.revert(commit);
            return resp.type("application/json").send({ success: true });
        }
        catch (err) {
            return resp
                .status(400)
                .type("application/json")
                .send({ error: err.message });
        }
    });
    app.post("/api/cherry-pick", async (req, resp) => {
        try {
            await git.raw(["cherry-pick", req.body.commit]);
            return resp.type("application/json").send({ success: true });
        }
        catch (err) {
            return resp
                .status(400)
                .type("application/json")
                .send({ error: err.message });
        }
    });
    app.post("/api/commit/drop", async (req, resp) => {
        try {
            await git.raw(["reset", "--hard", `${req.body.commit}^`]);
            return resp.type("application/json").send({ success: true });
        }
        catch (err) {
            return resp
                .status(400)
                .type("application/json")
                .send({ error: err.message });
        }
    });
    app.post("/api/reset-commit", async (req, resp) => {
        try {
            const mode = ["soft", "mixed", "hard"].includes(req.body?.mode)
                ? req.body.mode
                : "hard";
            await git.raw(["reset", `--${mode}`, req.body.commit]);
            return resp.type("application/json").send({ success: true });
        }
        catch (err) {
            return resp
                .status(400)
                .type("application/json")
                .send({ error: err.message });
        }
    });
    // ==================== Staging ====================
    app.get("/api/status", async (_req, resp) => {
        try {
            const status = await git.status();
            return resp.type("application/json").send(status);
        }
        catch (err) {
            return resp
                .status(400)
                .type("application/json")
                .send({ error: err.message });
        }
    });
    app.post("/api/stage", async (req, resp) => {
        try {
            await mutate(() => working.stage(req.body?.files));
            return resp.type("application/json").send({ success: true });
        }
        catch (err) {
            return resp
                .status(400)
                .type("application/json")
                .send({ error: err.message });
        }
    });
    app.post("/api/unstage", async (req, resp) => {
        try {
            await mutate(() => working.unstage(req.body?.files));
            return resp.type("application/json").send({ success: true });
        }
        catch (err) {
            return resp
                .status(400)
                .type("application/json")
                .send({ error: err.message });
        }
    });
    app.post("/api/stage-lines", async (req, resp) => {
        try {
            const { file, patch } = req.body;
            // Stage specific lines using git add -p equivalent (patch mode)
            await git.raw("add --patch", { input: patch });
            return resp.type("application/json").send({ success: true });
        }
        catch (err) {
            return resp
                .status(400)
                .type("application/json")
                .send({ error: err.message });
        }
    });
    // ==================== Branches ====================
    app.get("/api/branches/all", async (_req, resp) => {
        try {
            const raw = await git.raw([
                "for-each-ref",
                "--format=%(refname)%09%(objectname)%09%(HEAD)",
                "refs/heads",
                "refs/remotes",
            ]);
            const branches = raw
                .split("\n")
                .map((line) => line.trim())
                .filter(Boolean)
                .map((line) => {
                const [refname, commit, headMarker] = line.split("\t");
                const remote = refname.startsWith("refs/remotes/");
                const name = refname.replace(/^refs\/(heads|remotes)\//, "");
                return { name, commit, current: headMarker === "*", remote };
            });
            return resp.type("application/json").send(branches);
        }
        catch (err) {
            return resp
                .status(400)
                .type("application/json")
                .send({ error: err.message });
        }
    });
    app.get("/api/branches", async (_req, resp) => {
        try {
            const branchSummary = await git.branchLocal();
            return resp.type("application/json").send(branchSummary);
        }
        catch (err) {
            return resp
                .status(400)
                .type("application/json")
                .send({ error: err.message });
        }
    });
    app.post("/api/branch/create", async (req, resp) => {
        try {
            const { name, startPoint } = req.body;
            await git.branch([...(startPoint ? [name, startPoint] : [name])]);
            return resp.type("application/json").send({ success: true });
        }
        catch (err) {
            return resp
                .status(400)
                .type("application/json")
                .send({ error: err.message });
        }
    });
    app.post("/api/branch/delete", async (req, resp) => {
        try {
            const { name, force } = req.body;
            await git.deleteLocalBranch(name, force);
            return resp.type("application/json").send({ success: true });
        }
        catch (err) {
            return resp
                .status(400)
                .type("application/json")
                .send({ error: err.message });
        }
    });
    app.post("/api/branch/delete-remote", async (req, resp) => {
        try {
            const { remote, branch } = req.body;
            await git.push([remote, "--delete", branch]);
            return resp.type("application/json").send({ success: true });
        }
        catch (err) {
            return resp
                .status(400)
                .type("application/json")
                .send({ error: err.message });
        }
    });
    app.post("/api/branch/rename", async (req, resp) => {
        try {
            const { oldName, newName } = req.body;
            await git.branch(["-m", oldName, newName]);
            return resp.type("application/json").send({ success: true });
        }
        catch (err) {
            return resp
                .status(400)
                .type("application/json")
                .send({ error: err.message });
        }
    });
    // ==================== Worktrees ====================
    app.get("/api/worktrees", async (_req, resp) => {
        try {
            const raw = await git.raw(["worktree", "list", "--porcelain"]);
            // Path comparison is case-insensitive on Windows so the served worktree
            // is detected regardless of drive-letter casing.
            const samePath = (a, b) => process.platform === "win32"
                ? resolve(a).toLowerCase() === resolve(b).toLowerCase()
                : resolve(a) === resolve(b);
            const worktrees = raw
                .split(/\n\s*\n/)
                .map((block) => block.trim())
                .filter(Boolean)
                .map((block) => {
                const entry = {
                    path: "",
                    head: "",
                    branch: "",
                    bare: false,
                    detached: false,
                    current: false,
                };
                for (const line of block.split("\n").map((l) => l.trim())) {
                    if (line.startsWith("worktree "))
                        entry.path = line.slice("worktree ".length);
                    else if (line.startsWith("HEAD "))
                        entry.head = line.slice("HEAD ".length);
                    else if (line.startsWith("branch "))
                        entry.branch = line
                            .slice("branch ".length)
                            .replace(/^refs\/heads\//, "");
                    else if (line === "bare")
                        entry.bare = true;
                    else if (line === "detached")
                        entry.detached = true;
                }
                entry.current = !!entry.path && samePath(entry.path, repositoryPath);
                return entry;
            });
            return resp.type("application/json").send(worktrees);
        }
        catch (err) {
            return resp
                .status(400)
                .type("application/json")
                .send({ error: err.message });
        }
    });
    app.post("/api/worktrees", async (req, resp) => {
        try {
            const path = typeof req.body?.path === "string" ? req.body.path.trim() : "";
            const branch = typeof req.body?.branch === "string" ? req.body.branch.trim() : "";
            if (!path || !isAbsolute(path)) {
                throw new Error("Choose an absolute folder path for the worktree.");
            }
            if (!branch) {
                throw new Error("Choose a local branch for the worktree.");
            }
            // Resolve the branch as a local ref before passing it to Git. Besides a
            // clearer error, this prevents a request from treating an option as a ref.
            await git.raw([
                "show-ref",
                "--verify",
                "--quiet",
                `refs/heads/${branch}`,
            ]);
            await mutate(() => git
                .raw(["worktree", "add", "--", resolve(path), branch])
                .then(() => { }));
            return resp.type("application/json").send({ success: true });
        }
        catch (err) {
            return resp
                .status(400)
                .type("application/json")
                .send({ error: err.message });
        }
    });
    app.post("/api/worktrees/remove", async (req, resp) => {
        try {
            const path = typeof req.body?.path === "string" ? req.body.path.trim() : "";
            if (!path || !isAbsolute(path)) {
                throw new Error("A valid worktree path is required.");
            }
            const target = resolve(path);
            const samePath = (a, b) => process.platform === "win32"
                ? resolve(a).toLowerCase() === resolve(b).toLowerCase()
                : resolve(a) === resolve(b);
            if (samePath(target, repositoryPath)) {
                throw new Error("The worktree currently open in Guito cannot be removed.");
            }
            // Only registered worktrees may be removed. Do not use --force: Git must
            // protect uncommitted or untracked files in the selected worktree.
            const registered = (await git.raw(["worktree", "list", "--porcelain"]))
                .split(/\n\s*\n/)
                .some((block) => {
                const line = block
                    .split("\n")
                    .find((entry) => entry.startsWith("worktree "));
                return (!!line && samePath(line.slice("worktree ".length).trim(), target));
            });
            if (!registered) {
                throw new Error("The selected folder is not a registered worktree.");
            }
            await mutate(() => git.raw(["worktree", "remove", "--", target]).then(() => { }));
            return resp.type("application/json").send({ success: true });
        }
        catch (err) {
            return resp
                .status(400)
                .type("application/json")
                .send({ error: err.message });
        }
    });
    app.post("/api/checkout", async (req, resp) => {
        try {
            const { ref } = req.body;
            await git.checkout(ref);
            return resp.type("application/json").send({ success: true });
        }
        catch (err) {
            return resp
                .status(400)
                .type("application/json")
                .send({ error: err.message });
        }
    });
    // ==================== Merge & Rebase ====================
    app.post("/api/merge", async (req, resp) => {
        try {
            const { branch } = req.body;
            await git.merge([branch]);
            return resp.type("application/json").send({ success: true });
        }
        catch (err) {
            return resp
                .status(400)
                .type("application/json")
                .send({ error: err.message });
        }
    });
    app.get("/api/archive", async (req, resp) => {
        try {
            const ref = String(req.query?.ref ?? "HEAD");
            if (!/^[0-9a-fA-F]{7,40}$/.test(ref) && !/^[A-Za-z0-9._/-]+$/.test(ref)) {
                return resp
                    .status(400)
                    .type("application/json")
                    .send({ error: "invalid ref" });
            }
            const result = await execFileAsync("git", ["archive", "--format=zip", ref], {
                cwd: repositoryPath,
                encoding: "buffer",
                maxBuffer: 100 * 1024 * 1024,
            });
            return resp
                .header("Content-Disposition", `attachment; filename="guito-${ref.slice(0, 8)}.zip"`)
                .type("application/zip")
                .send(result.stdout);
        }
        catch (err) {
            return resp
                .status(400)
                .type("application/json")
                .send({ error: err.message });
        }
    });
    app.post("/api/rebase", async (req, resp) => {
        try {
            const { branch } = req.body;
            await git.rebase([branch]);
            return resp.type("application/json").send({ success: true });
        }
        catch (err) {
            return resp
                .status(400)
                .type("application/json")
                .send({ error: err.message });
        }
    });
    app.post("/api/squash", async (req, resp) => {
        try {
            const { commits } = req.body;
            // Squash: rebase -i with squash operation
            await git.rebase(["-i", "HEAD~" + commits]);
            return resp.type("application/json").send({ success: true });
        }
        catch (err) {
            return resp
                .status(400)
                .type("application/json")
                .send({ error: err.message });
        }
    });
    // ==================== Stash ====================
    app.get("/api/stash/list", async (_req, resp) => {
        try {
            // Extra fields (date, author) let the commit table render stash rows;
            // they are NUL-separated because messages cannot contain NUL.
            const raw = await git.raw([
                "stash",
                "list",
                "--format=%H%x00%aI%x00%aN%x00%aE%x00%s",
            ]);
            const all = raw
                .trim()
                .split("\n")
                .filter(Boolean)
                .map((line) => {
                const [hash, date, authorName, authorEmail, message] = line.split("\u0000");
                return {
                    hash,
                    date,
                    author_name: authorName,
                    author_email: authorEmail,
                    message,
                };
            });
            return resp.type("application/json").send({
                all,
                latest: all[0] ?? null,
                total: all.length,
            });
        }
        catch (err) {
            return resp
                .status(400)
                .type("application/json")
                .send({ error: err.message });
        }
    });
    app.post("/api/stash/save", async (req, resp) => {
        try {
            const { message, scope } = req.body ?? {};
            // 'staged' → index only (--staged, git ≥ 2.35); 'unstaged' → working tree only
            // (--keep-index leaves staged changes staged); 'all' → index + working tree.
            // Untracked files ride along for 'all'/'unstaged' since the panel lists them as unstaged.
            const args = ["push"];
            if (scope === "staged") {
                args.push("--staged");
            }
            else {
                if (scope === "unstaged")
                    args.push("--keep-index");
                args.push("-u");
            }
            if (message)
                args.push("-m", message);
            await git.stash(args);
            return resp.type("application/json").send({ success: true });
        }
        catch (err) {
            return resp
                .status(400)
                .type("application/json")
                .send({ error: err.message });
        }
    });
    app.post("/api/stash/apply", async (req, resp) => {
        try {
            const { index } = req.body;
            await git.stash(["apply", `stash@{${index}}`]);
            return resp.type("application/json").send({ success: true });
        }
        catch (err) {
            return resp
                .status(400)
                .type("application/json")
                .send({ error: err.message });
        }
    });
    app.post("/api/stash/pop", async (req, resp) => {
        try {
            const { index } = req.body;
            await git.stash(["pop", `stash@{${index}}`]);
            return resp.type("application/json").send({ success: true });
        }
        catch (err) {
            return resp
                .status(400)
                .type("application/json")
                .send({ error: err.message });
        }
    });
    app.post("/api/stash/drop", async (req, resp) => {
        try {
            const { index } = req.body;
            await git.stash(["drop", `stash@{${index}}`]);
            return resp.type("application/json").send({ success: true });
        }
        catch (err) {
            return resp
                .status(400)
                .type("application/json")
                .send({ error: err.message });
        }
    });
    app.post("/api/stash/show", async (req, resp) => {
        try {
            const { index } = req.body;
            const show = await git.stash(["show", "-p", `stash@{${index}}`]);
            return resp.type("application/json").send({ preview: show });
        }
        catch (err) {
            return resp
                .status(400)
                .type("application/json")
                .send({ error: err.message });
        }
    });
    // ==================== Tags ====================
    // All tags with the commit each points at (annotated tags are peeled, so the
    // client can always look the tagged commit up by hash). Sorted by name.
    app.get("/api/tags", async (_req, resp) => {
        try {
            const raw = await git.raw([
                "tag",
                "--list",
                "--sort=refname",
                "--format=%(refname:short)%09%(*objectname)%09%(objectname)",
            ]);
            const tags = raw
                .split("\n")
                .map((line) => line.split("\t"))
                .filter(([name]) => Boolean(name.trim()))
                .map(([name, peeled, direct]) => ({ name, hash: peeled || direct }));
            return resp.type("application/json").send(tags);
        }
        catch (err) {
            return resp
                .status(400)
                .type("application/json")
                .send({ error: err.message });
        }
    });
    app.post("/api/tag/create", async (req, resp) => {
        try {
            const { name, message, commit } = req.body;
            if (message) {
                await git.tag(["-a", name, "-m", message, ...(commit ? [commit] : [])]);
            }
            else {
                await git.tag([name, ...(commit ? [commit] : [])]);
            }
            return resp.type("application/json").send({ success: true });
        }
        catch (err) {
            return resp
                .status(400)
                .type("application/json")
                .send({ error: err.message });
        }
    });
    app.post("/api/tag/delete", async (req, resp) => {
        try {
            const { name } = req.body;
            await git.tag(["-d", name]);
            return resp.type("application/json").send({ success: true });
        }
        catch (err) {
            return resp
                .status(400)
                .type("application/json")
                .send({ error: err.message });
        }
    });
    app.post("/api/tag/push", async (req, resp) => {
        try {
            const { name, remote } = req.body;
            if (!name) {
                return resp
                    .status(400)
                    .type("application/json")
                    .send({ error: "name required" });
            }
            await git.push(remote || "origin", `refs/tags/${name}`);
            return resp.type("application/json").send({ success: true });
        }
        catch (err) {
            return resp
                .status(400)
                .type("application/json")
                .send({ error: err.message });
        }
    });
    // ==================== Remote Operations ====================
    app.get("/api/fetch", async (req, resp) => {
        try {
            const prune = ["1", "true", "yes"].includes(String(req.query?.prune ?? "").toLowerCase());
            await git.fetch(prune ? { "--prune": null } : {});
            return resp.type("application/json").send({ success: true });
        }
        catch (err) {
            return resp
                .status(400)
                .type("application/json")
                .send({ error: err.message });
        }
    });
    app.post("/api/pull", async (req, resp) => {
        try {
            const { remote, branch, rebase } = req.body;
            await git.pull(remote || "origin", branch || undefined, rebase ? { "--rebase": null } : {});
            return resp.type("application/json").send({ success: true });
        }
        catch (err) {
            return resp
                .status(400)
                .type("application/json")
                .send({ error: err.message });
        }
    });
    app.post("/api/push", async (req, resp) => {
        try {
            const { remote, branch, force } = req.body;
            await git.push(remote || "origin", branch || undefined, force ? { "-f": null } : {});
            return resp.type("application/json").send({ success: true });
        }
        catch (err) {
            return resp
                .status(400)
                .type("application/json")
                .send({ error: err.message });
        }
    });
    app.post("/api/sync", async (_req, resp) => {
        try {
            await git.pull("origin", undefined, {});
            await git.push("origin", undefined, {});
            return resp.type("application/json").send({ success: true });
        }
        catch (err) {
            return resp
                .status(400)
                .type("application/json")
                .send({ error: err.message });
        }
    });
    app.post("/api/prune", async (req, resp) => {
        try {
            const { remote } = req.body;
            await git.remote(["prune", remote || "origin"]);
            return resp.type("application/json").send({ success: true });
        }
        catch (err) {
            return resp
                .status(400)
                .type("application/json")
                .send({ error: err.message });
        }
    });
    const listRemotes = async () => {
        const names = (await git.raw(["remote"]))
            .split(/\r?\n/)
            .map((name) => name.trim())
            .filter(Boolean);
        return Promise.all(names.map(async (name) => {
            const fetchUrl = (await git.raw(["remote", "get-url", name])).trim();
            const pushUrl = (await git
                .raw(["remote", "get-url", "--push", name])
                .catch(() => fetchUrl)).trim();
            return { name, fetchUrl, pushUrl };
        }));
    };
    app.get("/api/remotes", async (_req, resp) => {
        try {
            return resp.type("application/json").send(await listRemotes());
        }
        catch (err) {
            return resp.status(400).send({ error: err.message });
        }
    });
    app.post("/api/remotes", async (req, resp) => {
        try {
            const name = String(req.body?.name ?? "").trim();
            const originalName = String(req.body?.originalName ?? "").trim();
            const fetchUrl = String(req.body?.fetchUrl ?? "").trim();
            const pushUrl = String(req.body?.pushUrl ?? "").trim() || fetchUrl;
            if (!/^[A-Za-z0-9._-]+$/.test(name) || !fetchUrl) {
                return resp
                    .status(400)
                    .send({ error: "A valid remote name and fetch URL are required." });
            }
            if (!originalName) {
                await git.raw(["remote", "add", name, fetchUrl]);
            }
            else {
                if (originalName !== name)
                    await git.raw(["remote", "rename", originalName, name]);
                await git.raw(["remote", "set-url", name, fetchUrl]);
            }
            await git.raw(["remote", "set-url", "--push", name, pushUrl]);
            return resp.send(await listRemotes());
        }
        catch (err) {
            return resp.status(400).send({ error: err.message });
        }
    });
    app.delete("/api/remotes/:name", async (req, resp) => {
        try {
            const name = String(req.params?.name ?? "").trim();
            if (!/^[A-Za-z0-9._-]+$/.test(name)) {
                return resp.status(400).send({ error: "Invalid remote name." });
            }
            await git.raw(["remote", "remove", name]);
            return resp.send(await listRemotes());
        }
        catch (err) {
            return resp.status(400).send({ error: err.message });
        }
    });
    app.post("/api/identity", async (req, resp) => {
        try {
            const name = String(req.body?.name ?? "").trim();
            const email = String(req.body?.email ?? "").trim();
            if (!name || !email) {
                return resp
                    .status(400)
                    .send({ error: "User name and email are required." });
            }
            await git.raw(["config", "--local", "user.name", name]);
            await git.raw(["config", "--local", "user.email", email]);
            return resp.send(await configuredIdentity());
        }
        catch (err) {
            return resp.status(400).send({ error: err.message });
        }
    });
    app.delete("/api/identity", async (_req, resp) => {
        try {
            await git
                .raw(["config", "--local", "--unset-all", "user.name"])
                .catch(() => "");
            await git
                .raw(["config", "--local", "--unset-all", "user.email"])
                .catch(() => "");
            return resp.send(await configuredIdentity());
        }
        catch (err) {
            return resp.status(400).send({ error: err.message });
        }
    });
    // ==================== Settings ====================
    app.get("/api/settings", async (_req, resp) => {
        try {
            const settings = await effectiveSettings();
            return resp.type("application/json").send(settings);
        }
        catch (err) {
            return resp
                .status(400)
                .type("application/json")
                .send({ error: err.message });
        }
    });
    app.post("/api/settings", async (req, resp) => {
        try {
            const body = req.body ?? {};
            const settings = await readSettings();
            if ("azureDevOpsUrl" in body) {
                const url = String(body.azureDevOpsUrl ?? "").trim();
                if (url && !/^https?:\/\//i.test(url)) {
                    return resp.status(400).type("application/json").send({
                        error: "The Azure DevOps URL must start with http:// or https://.",
                    });
                }
                settings.azureDevOpsUrl = url;
            }
            if ("prBranchNameTemplate" in body) {
                const template = String(body.prBranchNameTemplate ?? "").trim();
                if (template.length > 200) {
                    return resp.status(400).send({
                        error: "The pull request branch template must be 200 characters or fewer.",
                    });
                }
                try {
                    formatPrBranchName(template, {
                        username: "username",
                        randomstring: "randomstring",
                        branch: "branch",
                        targetbranch: "targetbranch",
                        title: "title",
                        repository: "repository",
                        date: "2026-09-12",
                        time: "120000",
                        timestamp: "1789214400000",
                    });
                }
                catch (error) {
                    return resp.status(400).send({ error: error.message });
                }
                settings.prBranchNameTemplate =
                    template || DEFAULT_PR_BRANCH_NAME_TEMPLATE;
            }
            if (typeof body.showGraph === "boolean") {
                settings.showGraph = body.showGraph;
            }
            if (typeof body.autoReload === "boolean") {
                settings.autoReload = body.autoReload;
            }
            if (typeof body.showStashes === "boolean") {
                settings.showStashes = body.showStashes;
            }
            if (typeof body.showTags === "boolean") {
                settings.showTags = body.showTags;
            }
            if (typeof body.showRemoteBranches === "boolean") {
                settings.showRemoteBranches = body.showRemoteBranches;
            }
            if (body.fileListView === "tree" || body.fileListView === "flat") {
                settings.fileListView = body.fileListView;
            }
            if (body.searchMode === "filter" || body.searchMode === "navigate") {
                settings.searchMode = body.searchMode;
            }
            if (typeof body.searchCaseSensitive === "boolean") {
                settings.searchCaseSensitive = body.searchCaseSensitive;
            }
            if (typeof body.allowMerge === "boolean") {
                settings.allowMerge = body.allowMerge;
            }
            if ("issueLinking" in body) {
                if (body.issueLinking === null) {
                    if (body.issueLinkingGlobal) {
                        await git
                            .raw(["config", "--global", "--unset-all", "guito.issueRegex"])
                            .catch(() => "");
                        await git
                            .raw(["config", "--global", "--unset-all", "guito.issueUrl"])
                            .catch(() => "");
                    }
                    else {
                        delete settings.issueLinking;
                    }
                }
                else {
                    const regex = String(body.issueLinking?.regex ?? "").trim();
                    const url = String(body.issueLinking?.url ?? "").trim();
                    if (!regex || !url) {
                        return resp
                            .status(400)
                            .send({ error: "Issue regex and URL are required." });
                    }
                    try {
                        new RegExp(regex);
                    }
                    catch {
                        return resp.status(400).send({
                            error: "Issue regex is not a valid regular expression.",
                        });
                    }
                    if (!/^https?:\/\//i.test(url)) {
                        return resp.status(400).send({
                            error: "Issue URL must start with http:// or https://.",
                        });
                    }
                    if (body.issueLinking.useGlobally) {
                        await git.raw(["config", "--global", "guito.issueRegex", regex]);
                        await git.raw(["config", "--global", "guito.issueUrl", url]);
                        delete settings.issueLinking;
                    }
                    else {
                        settings.issueLinking = { regex, url };
                    }
                }
            }
            await writeSettings(settings);
            const effective = await effectiveSettings();
            return resp.type("application/json").send(effective);
        }
        catch (err) {
            return resp
                .status(400)
                .type("application/json")
                .send({ error: err.message });
        }
    });
    // ==================== Azure DevOps Pull Requests ====================
    app.post("/api/azure-devops/pullrequest", async (req, resp) => {
        try {
            const { sourceBranch, targetBranch, title, description, newBranch } = req.body ?? {};
            if (!targetBranch) {
                return resp
                    .status(400)
                    .type("application/json")
                    .send({ error: "targetBranch required" });
            }
            const { prefix, remoteUrl } = await azureProjectContext();
            const info = parseAzureRemoteUrl(remoteUrl);
            if (!info) {
                return resp.status(400).type("application/json").send({
                    error: "Unable to build the Azure DevOps pull request URL.",
                });
            }
            const prUrl = `${prefix}/_apis/git/repositories/${encodeURIComponent(info.repo)}/pullrequests?api-version=${AZURE_API_VERSION}`;
            let source = String(sourceBranch ?? "").trim();
            if (newBranch) {
                // Create a remote-only branch from the current HEAD; the local
                // repository and the checked-out branch stay untouched.
                const now = new Date();
                const currentSettings = await effectiveSettings();
                let computerUsername = process.env.USERNAME || process.env.USER || "";
                try {
                    computerUsername = userInfo().username || computerUsername;
                }
                catch {
                    // Environment variables are a sufficient fallback in restricted hosts.
                }
                const name = formatPrBranchName(currentSettings.prBranchNameTemplate, {
                    username: computerUsername,
                    randomstring: randomBranchSuffix(),
                    branch: (await git.revparse(["--abbrev-ref", "HEAD"])).trim(),
                    targetbranch: String(targetBranch)
                        .replace(/^refs\/heads\//, "")
                        .replace(/^origin\//, ""),
                    title: String(title ?? "").trim() || "pull-request",
                    repository: basename(await repoRoot()),
                    date: now.toISOString().slice(0, 10),
                    time: now.toISOString().slice(11, 19).replace(/:/g, ""),
                    timestamp: String(now.getTime()),
                });
                try {
                    await git.raw(["check-ref-format", "--branch", name]);
                }
                catch {
                    return resp.status(400).send({
                        error: `The pull request branch template produced an invalid Git branch name: ${name}`,
                    });
                }
                const existingBranch = await git
                    .raw(["ls-remote", "--heads", "origin", `refs/heads/${name}`])
                    .catch(() => "");
                if (existingBranch.trim()) {
                    return resp.status(400).send({
                        error: `The pull request branch already exists on origin: ${name}`,
                    });
                }
                await git.push(["origin", `HEAD:refs/heads/${name}`]);
                source = name;
            }
            else {
                if (!source) {
                    return resp
                        .status(400)
                        .type("application/json")
                        .send({ error: "sourceBranch required" });
                }
                if (source.startsWith("origin/")) {
                    // Remote-tracking branch: the PR source is the branch name on the remote.
                    source = source.slice("origin/".length);
                }
                else {
                    // Publish the branch first when the remote does not have it yet.
                    // The remote-tracking ref is a local check; a redundant push is a
                    // harmless no-op ("Everything up-to-date").
                    // rev-parse --verify --quiet does not fail reliably through
                    // simple-git, so list the tracking refs instead.
                    const trackingRefs = await git.raw([
                        "for-each-ref",
                        "refs/remotes/origin",
                        "--format=%(refname)",
                    ]);
                    const published = trackingRefs
                        .split("\n")
                        .some((line) => line.trim() === `refs/remotes/origin/${source}`);
                    if (!published) {
                        await git.push(["origin", source]);
                    }
                }
            }
            const payload = {
                isDraft: req.body?.isDraft === true,
                sourceRefName: `refs/heads/${source}`,
                targetRefName: `refs/heads/${String(targetBranch)
                    .replace(/^refs\/heads\//, "")
                    .replace(/^origin\//, "")}`,
            };
            const trimmedTitle = String(title ?? "").trim();
            const trimmedDescription = String(description ?? "").trim();
            if (trimmedTitle) {
                payload.title = trimmedTitle;
            }
            if (trimmedDescription) {
                payload.description = trimmedDescription;
            }
            const reviewerList = Array.isArray(req.body?.reviewers)
                ? req.body.reviewers
                : [];
            const payloadReviewers = reviewerList
                .map((entry) => ({
                id: String(entry?.id ?? ""),
                isRequired: !!entry?.required,
            }))
                .filter((entry) => entry.id);
            if (payloadReviewers.length) {
                payload.reviewers = payloadReviewers;
            }
            const workItemList = Array.isArray(req.body?.workItems)
                ? req.body.workItems
                : [];
            const payloadWorkItems = workItemList
                .map((id) => Number(id))
                .filter((id) => Number.isInteger(id) && id > 0);
            if (payloadWorkItems.length) {
                payload.workItemRefs = payloadWorkItems.map((id) => ({
                    id: String(id),
                }));
            }
            const result = await azureRequest("POST", prUrl, JSON.stringify(payload));
            if (result.status < 200 || result.status >= 300) {
                return resp
                    .status(400)
                    .type("application/json")
                    .send({
                    error: azureErrorMessage(result) ||
                        `Azure DevOps returned HTTP ${result.status}.`,
                });
            }
            const created = JSON.parse(result.body);
            // Tags (labels) are a separate resource; add them after the PR exists.
            const labelNames = (Array.isArray(req.body?.labels) ? req.body.labels : [])
                .map((name) => String(name ?? "").trim())
                .filter(Boolean);
            const warnings = [];
            if (labelNames.length && created.pullRequestId) {
                // Built from the prefix: prUrl already carries the api-version query.
                const labelsUrl = `${prefix}/_apis/git/repositories/${encodeURIComponent(info.repo)}` +
                    `/pullrequests/${created.pullRequestId}/labels?api-version=${AZURE_API_VERSION}`;
                for (const name of labelNames) {
                    try {
                        const labelResult = await azureRequest("POST", labelsUrl, JSON.stringify({ name }));
                        if (labelResult.status < 200 || labelResult.status >= 300) {
                            warnings.push(`Could not add tag "${name}" (HTTP ${labelResult.status}).`);
                        }
                    }
                    catch (err) {
                        warnings.push(`Could not add tag "${name}": ${err.message}`);
                    }
                }
            }
            return resp.type("application/json").send({
                id: created.pullRequestId,
                url: created._links?.web?.href ?? "",
                branch: source,
                ...(warnings.length ? { warnings } : {}),
            });
        }
        catch (err) {
            return resp
                .status(400)
                .type("application/json")
                .send({ error: err.message });
        }
    });
    // ==================== Azure DevOps PR metadata ====================
    // Collection-scoped identity IDs can be passed directly as PR reviewers.
    app.get("/api/azure-devops/reviewers", async (req, resp) => {
        try {
            const query = String((req.query ?? {}).query ?? "").trim();
            if (!query) {
                return resp.type("application/json").send({ reviewers: [] });
            }
            const { prefix } = await azureProjectContext();
            const collection = prefix.slice(0, prefix.lastIndexOf("/"));
            const identityBase = collection.replace("https://dev.azure.com/", "https://vssps.dev.azure.com/");
            const url = `${identityBase}/_apis/identities?api-version=5.0-preview` +
                `&searchFilter=General&filterValue=${encodeURIComponent(query)}&queryMembership=None`;
            const result = await azureRequest("GET", url, "");
            if (result.status < 200 || result.status >= 300) {
                return resp
                    .status(400)
                    .type("application/json")
                    .send({
                    error: azureErrorMessage(result) ||
                        `Azure DevOps returned HTTP ${result.status}.`,
                });
            }
            const data = JSON.parse(result.body);
            const list = Array.isArray(data)
                ? data
                : (data.value ?? data.identities ?? []);
            const reviewers = list
                .map((entry) => ({
                id: String(entry?.id ?? entry?.identity?.id ?? ""),
                label: String(entry?.customDisplayName ||
                    entry?.providerDisplayName ||
                    entry?.label ||
                    entry?.displayName ||
                    entry?.name ||
                    ""),
                description: entry?.properties?.Mail?.$value ??
                    entry?.properties?.Account?.$value ??
                    entry?.description ??
                    undefined,
            }))
                .filter((entry) => entry.id && entry.label);
            return resp.type("application/json").send({ reviewers });
        }
        catch (err) {
            return resp
                .status(400)
                .type("application/json")
                .send({ error: err.message });
        }
    });
    // Work item search by id or title: a WIQL query returns ids, a batch read
    // then fetches title/state for the first matches.
    app.get("/api/azure-devops/workitems", async (req, resp) => {
        try {
            const query = String((req.query ?? {}).query ?? "")
                .trim()
                .replace(/^#(?=\d+$)/, "");
            if (!query) {
                return resp.type("application/json").send({ workItems: [] });
            }
            const { prefix } = await azureProjectContext();
            const clauses = [
                `[System.Title] CONTAINS '${query.replace(/'/g, "''")}'`,
            ];
            if (/^\d+$/.test(query)) {
                clauses.push(`[System.Id] = ${Number(query)}`);
            }
            const wiql = "SELECT [System.Id], [System.Title], [System.State] FROM WorkItems " +
                `WHERE [System.TeamProject] = @project AND (${clauses.map((clause) => `(${clause})`).join(" OR ")}) ` +
                "ORDER BY [System.ChangedDate] DESC";
            const wiqlResult = await azureRequest("POST", `${prefix}/_apis/wit/wiql?$top=20&api-version=${AZURE_API_VERSION}`, JSON.stringify({ query: wiql }));
            if (wiqlResult.status < 200 || wiqlResult.status >= 300) {
                return resp
                    .status(400)
                    .type("application/json")
                    .send({
                    error: azureErrorMessage(wiqlResult) ||
                        `Azure DevOps returned HTTP ${wiqlResult.status}.`,
                });
            }
            const ids = (JSON.parse(wiqlResult.body).workItems ?? [])
                .map((entry) => Number(entry?.id))
                .filter((id) => Number.isInteger(id) && id > 0)
                .slice(0, 20);
            if (!ids.length) {
                return resp.type("application/json").send({ workItems: [] });
            }
            const batchResult = await azureRequest("GET", `${prefix}/_apis/wit/workitems?ids=${ids.join(",")}` +
                `&fields=System.Id,System.Title,System.State&api-version=${AZURE_API_VERSION}`, "");
            if (batchResult.status < 200 || batchResult.status >= 300) {
                return resp
                    .status(400)
                    .type("application/json")
                    .send({
                    error: azureErrorMessage(batchResult) ||
                        `Azure DevOps returned HTTP ${batchResult.status}.`,
                });
            }
            const workItems = (JSON.parse(batchResult.body).value ?? []).map((item) => ({
                id: Number(item?.id),
                title: String(item?.fields?.["System.Title"] ?? ""),
                state: String(item?.fields?.["System.State"] ?? ""),
            }));
            return resp.type("application/json").send({ workItems });
        }
        catch (err) {
            return resp
                .status(400)
                .type("application/json")
                .send({ error: err.message });
        }
    });
    // Existing pull request labels for the tag autocomplete.
    app.get("/api/azure-devops/tags", async (_req, resp) => {
        try {
            const { prefix, remoteUrl } = await azureProjectContext();
            const repo = parseAzureRemoteUrl(remoteUrl).repo;
            // PR labels are distinct from Azure Boards work item tags.
            const names = new Set();
            for (let skip = 0;; skip += 100) {
                const result = await azureRequest("GET", `${prefix}/_apis/git/repositories/${encodeURIComponent(repo)}/pullrequests` +
                    `?searchCriteria.status=all&$top=100&$skip=${skip}&api-version=${AZURE_API_VERSION}`, "");
                if (result.status < 200 || result.status >= 300) {
                    throw new Error(azureErrorMessage(result) ||
                        `Azure DevOps returned HTTP ${result.status}.`);
                }
                const data = JSON.parse(result.body);
                const requests = Array.isArray(data) ? data : (data.value ?? []);
                // Some Server releases omit labels from the PR list response.
                // Read those resources explicitly, with at most five requests in flight.
                for (let offset = 0; offset < requests.length; offset += 5) {
                    const labels = await Promise.all(requests.slice(offset, offset + 5).map(async (request) => {
                        if (Array.isArray(request.labels))
                            return request.labels;
                        if (!Number.isInteger(request.pullRequestId))
                            return [];
                        const result = await azureRequest("GET", `${prefix}/_apis/git/repositories/${encodeURIComponent(repo)}` +
                            `/pullrequests/${request.pullRequestId}/labels?api-version=${AZURE_API_VERSION}`, "");
                        if (result.status < 200 || result.status >= 300) {
                            throw new Error(azureErrorMessage(result) ||
                                `Azure DevOps returned HTTP ${result.status}.`);
                        }
                        const data = JSON.parse(result.body);
                        return Array.isArray(data) ? data : (data.value ?? []);
                    }));
                    for (const label of labels.flat()) {
                        if (typeof label.name === "string" && label.name.trim())
                            names.add(label.name.trim());
                    }
                }
                if (requests.length < 100)
                    break;
            }
            const tags = [...names].sort((a, b) => a.localeCompare(b));
            return resp.type("application/json").send({ tags });
        }
        catch (err) {
            return resp
                .status(400)
                .type("application/json")
                .send({ error: err.message });
        }
    });
    // ==================== Azure DevOps pull request review ====================
    // Everything the PR sidebar list and the PR detail dialog need: identity,
    // listing, editing, votes, reviewers, auto-complete, completion, comment
    // threads, and per-file diffs.
    app.get("/api/azure-devops/me", async (_req, resp) => {
        try {
            return resp.type("application/json").send(await azureMe());
        }
        catch (err) {
            return resp
                .status(400)
                .type("application/json")
                .send({ error: err.message });
        }
    });
    // Pull requests the current user created or reviews ("mine"), merged and
    // de-duplicated. Status defaults to active.
    app.get("/api/azure-devops/pullrequests", async (req, resp) => {
        try {
            const status = String(req.query?.status ?? "active").trim() || "active";
            const { prefix, remoteUrl } = await azureProjectContext();
            const repo = parseAzureRemoteUrl(remoteUrl).repo;
            const me = await azureMe();
            const collect = async (criteria) => {
                const found = new Map();
                for (let skip = 0;; skip += 100) {
                    const url = `${prefix}/_apis/git/repositories/${encodeURIComponent(repo)}/pullrequests` +
                        `?searchCriteria.status=${encodeURIComponent(status)}&searchCriteria.${criteria}` +
                        `&$top=100&$skip=${skip}&api-version=${AZURE_API_VERSION}`;
                    const data = await azureJson("GET", url);
                    const requests = Array.isArray(data?.value) ? data.value : [];
                    for (const request of requests) {
                        const id = Number(request?.pullRequestId);
                        if (Number.isInteger(id) && id > 0 && !found.has(id)) {
                            found.set(id, request);
                        }
                    }
                    if (requests.length < 100)
                        break;
                }
                return found;
            };
            const [created, assigned] = await Promise.all([
                collect(`creatorId=${encodeURIComponent(me.id)}`),
                collect(`reviewerId=${encodeURIComponent(me.id)}`),
            ]);
            const merged = new Map([...created, ...assigned]);
            const pullRequests = [...merged.values()]
                .map((request) => mapAzurePullRequest(request, prefix, remoteUrl, me))
                .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
            return resp.type("application/json").send({ pullRequests });
        }
        catch (err) {
            return resp
                .status(400)
                .type("application/json")
                .send({ error: err.message });
        }
    });
    app.get("/api/azure-devops/pullrequests/:id", async (req, resp) => {
        try {
            const { base, prefix, remoteUrl } = await azurePrApiBase(Number(req.params?.id));
            const [pr, me] = await Promise.all([
                azureJson("GET", `${base}?api-version=${AZURE_API_VERSION}`),
                azureMe(),
            ]);
            const summary = mapAzurePullRequest(pr, prefix, remoteUrl, me);
            // Some Server releases omit labels from the PR detail response; read
            // the labels resource explicitly in that case instead of reporting a
            // false empty tag list.
            let labels = (Array.isArray(pr?.labels) ? pr.labels : [])
                .map((label) => String(label?.name ?? ""))
                .filter(Boolean);
            if (!Array.isArray(pr?.labels)) {
                const labelsResult = await azureRequest("GET", `${base}/labels?api-version=${AZURE_API_VERSION}`, "");
                if (labelsResult.status < 200 || labelsResult.status >= 300) {
                    throw new Error(azureErrorMessage(labelsResult) ||
                        `Azure DevOps returned HTTP ${labelsResult.status} while reading pull request tags.`);
                }
                const labelData = JSON.parse(labelsResult.body);
                labels = (Array.isArray(labelData) ? labelData : (labelData.value ?? []))
                    .map((label) => String(label?.name ?? ""))
                    .filter(Boolean);
            }
            return resp.type("application/json").send({
                ...summary,
                description: String(pr?.description ?? ""),
                autoCompleteSetBy: pr?.autoCompleteSetBy
                    ? {
                        id: String(pr.autoCompleteSetBy.id ?? ""),
                        name: String(pr.autoCompleteSetBy.displayName ?? ""),
                    }
                    : null,
                completionOptions: pr?.completionOptions ?? null,
                lastMergeSourceCommit: String(pr?.lastMergeSourceCommit?.commitId ?? ""),
                lastMergeTargetCommit: String(pr?.lastMergeTargetCommit?.commitId ?? ""),
                labels,
                mergeStatus: azureMergeStatus(pr),
            });
        }
        catch (err) {
            return resp
                .status(400)
                .type("application/json")
                .send({ error: err.message });
        }
    });
    // Edits title/description or flips the draft flag ("publish"/"convert to draft").
    app.patch("/api/azure-devops/pullrequests/:id", async (req, resp) => {
        try {
            const { title, description, isDraft } = req.body ?? {};
            const payload = {};
            if (title !== undefined)
                payload.title = String(title);
            if (description !== undefined)
                payload.description = String(description);
            if (isDraft !== undefined)
                payload.isDraft = isDraft === true;
            if (!Object.keys(payload).length) {
                return resp
                    .status(400)
                    .type("application/json")
                    .send({ error: "Nothing to update." });
            }
            const { base } = await azurePrApiBase(Number(req.params?.id));
            await azureJson("PATCH", `${base}?api-version=${AZURE_API_VERSION}`, JSON.stringify(payload));
            return resp.type("application/json").send({ ok: true });
        }
        catch (err) {
            return resp
                .status(400)
                .type("application/json")
                .send({ error: err.message });
        }
    });
    // Records the current user's vote on the pull request.
    app.post("/api/azure-devops/pullrequests/:id/vote", async (req, resp) => {
        try {
            const vote = String(req.body?.vote ?? "");
            if (!(vote in AZURE_VOTES)) {
                return resp
                    .status(400)
                    .type("application/json")
                    .send({ error: `Unknown vote "${vote}".` });
            }
            const { base } = await azurePrApiBase(Number(req.params?.id));
            const me = await azureMe();
            await azureJson("PUT", `${base}/reviewers/${encodeURIComponent(me.id)}?api-version=${AZURE_API_VERSION}`, JSON.stringify({ vote: AZURE_VOTES[vote] }));
            return resp.type("application/json").send({ ok: true });
        }
        catch (err) {
            return resp
                .status(400)
                .type("application/json")
                .send({ error: err.message });
        }
    });
    // Adds or updates a reviewer (optionally required), or removes one.
    app.post("/api/azure-devops/pullrequests/:id/reviewers", async (req, resp) => {
        try {
            const id = String(req.body?.id ?? "");
            if (!id) {
                return resp
                    .status(400)
                    .type("application/json")
                    .send({ error: "Reviewer id required." });
            }
            const { base } = await azurePrApiBase(Number(req.params?.id));
            const reviewerUrl = `${base}/reviewers/${encodeURIComponent(id)}?api-version=${AZURE_API_VERSION}`;
            if (req.body?.remove === true) {
                await azureJson("DELETE", reviewerUrl);
                return resp.type("application/json").send({ ok: true });
            }
            // The PUT replaces the reviewer record, so an existing vote is passed
            // through to survive an isRequired toggle.
            const payload = {
                isRequired: req.body?.required === true,
            };
            if (req.body?.vote !== undefined &&
                Number.isFinite(Number(req.body.vote))) {
                payload.vote = Number(req.body.vote);
            }
            await azureJson("PUT", reviewerUrl, JSON.stringify(payload));
            return resp.type("application/json").send({ ok: true });
        }
        catch (err) {
            return resp
                .status(400)
                .type("application/json")
                .send({ error: err.message });
        }
    });
    /** Maps dialog completion options onto the Azure DevOps payload shape. */
    const completionOptionsOf = (body) => {
        const strategies = ["noFastForward", "squash", "rebase", "rebaseMerge"];
        const mergeStrategy = String(body?.mergeStrategy ?? "");
        const options = {};
        if (strategies.includes(mergeStrategy))
            options.mergeStrategy = mergeStrategy;
        if (body?.deleteSourceBranch !== undefined) {
            options.deleteSourceBranch = body.deleteSourceBranch === true;
        }
        const completeWorkItems = body?.completeWorkItems === true;
        if (completeWorkItems) {
            options.completeWorkItems = true;
            // Transitioning requires completion of linked work items.
            if (body?.transitionWorkItems === true)
                options.transitionWorkItems = true;
        }
        return Object.keys(options).length ? options : null;
    };
    // Sets or clears auto-complete with optional completion options.
    app.post("/api/azure-devops/pullrequests/:id/autocomplete", async (req, resp) => {
        try {
            const enabled = req.body?.enabled === true;
            const { base } = await azurePrApiBase(Number(req.params?.id));
            const buildPayload = (identity) => {
                const payload = {
                    autoCompleteSetBy: identity,
                };
                if (enabled) {
                    const options = completionOptionsOf(req.body);
                    if (options)
                        payload.completionOptions = options;
                }
                return JSON.stringify(payload);
            };
            const url = `${base}?api-version=${AZURE_API_VERSION}`;
            const me = enabled ? await azureMe() : null;
            // Azure DevOps clears auto-complete for an empty identity; some Server
            // releases only accept an explicit null, so retry that shape on failure.
            try {
                await azureJson("PATCH", url, buildPayload(enabled && me ? { id: me.id } : { id: "" }));
            }
            catch (firstError) {
                if (enabled)
                    throw firstError;
                await azureJson("PATCH", url, buildPayload(null));
            }
            return resp.type("application/json").send({ ok: true });
        }
        catch (err) {
            return resp
                .status(400)
                .type("application/json")
                .send({ error: err.message });
        }
    });
    // Completes the pull request (merge). Requires the merge source commit for
    // optimistic concurrency, exactly like the Azure DevOps web dialog.
    app.post("/api/azure-devops/pullrequests/:id/complete", async (req, resp) => {
        try {
            const { base } = await azurePrApiBase(Number(req.params?.id));
            const pr = await azureJson("GET", `${base}?api-version=${AZURE_API_VERSION}`);
            const commitId = String(pr?.lastMergeSourceCommit?.commitId ?? "");
            if (!commitId) {
                throw new Error("The pull request has no merge commit to complete yet.");
            }
            const payload = {
                status: "completed",
                lastMergeSourceCommit: { commitId },
            };
            const options = completionOptionsOf(req.body);
            if (options)
                payload.completionOptions = options;
            await azureJson("PATCH", `${base}?api-version=${AZURE_API_VERSION}`, JSON.stringify(payload));
            return resp.type("application/json").send({ ok: true });
        }
        catch (err) {
            return resp
                .status(400)
                .type("application/json")
                .send({ error: err.message });
        }
    });
    app.get("/api/azure-devops/pullrequests/:id/threads", async (req, resp) => {
        try {
            const { base } = await azurePrApiBase(Number(req.params?.id));
            const data = await azureJson("GET", `${base}/threads?api-version=${AZURE_API_VERSION}`);
            const threads = (Array.isArray(data?.value) ? data.value : [])
                .filter((thread) => thread?.isDeleted !== true)
                .map((thread) => {
                const context = thread?.threadContext ?? {};
                const line = context.rightFileStart?.line ??
                    context.leftFileStart?.line ??
                    null;
                return {
                    id: Number(thread?.id ?? 0),
                    status: azureThreadStatusName(Number(thread?.status ?? 0)),
                    isDeleted: false,
                    filePath: typeof context.filePath === "string"
                        ? context.filePath.replace(/^\//, "")
                        : null,
                    line: Number.isInteger(line) ? line : null,
                    side: context.rightFileStart
                        ? "right"
                        : context.leftFileStart
                            ? "left"
                            : null,
                    comments: (Array.isArray(thread?.comments) ? thread.comments : [])
                        .filter((comment) => comment?.isDeleted !== true)
                        .map((comment) => ({
                        id: Number(comment?.id ?? 0),
                        author: {
                            name: String(comment?.author?.displayName ?? ""),
                            email: String(comment?.author?.uniqueName ?? ""),
                        },
                        content: String(comment?.content ?? ""),
                        createdAt: String(comment?.publishedDate ?? ""),
                        isDeleted: false,
                    })),
                };
            });
            return resp.type("application/json").send({ threads });
        }
        catch (err) {
            return resp
                .status(400)
                .type("application/json")
                .send({ error: err.message });
        }
    });
    // Adds a comment: a reply to a thread, a general PR comment, or an inline
    // comment anchored to a file line (thread context).
    app.post("/api/azure-devops/pullrequests/:id/threads", async (req, resp) => {
        try {
            const content = String(req.body?.content ?? "").trim();
            if (!content) {
                return resp
                    .status(400)
                    .type("application/json")
                    .send({ error: "Comment text required." });
            }
            const { base } = await azurePrApiBase(Number(req.params?.id));
            const threadId = Number(req.body?.threadId ?? 0);
            if (Number.isInteger(threadId) && threadId > 0) {
                await azureJson("POST", `${base}/threads/${threadId}/comments?api-version=${AZURE_API_VERSION}`, JSON.stringify({ content }));
                return resp.type("application/json").send({ ok: true });
            }
            const payload = {
                status: AZURE_THREAD_STATUSES.active,
                comments: [{ content, parentCommentId: 0 }],
            };
            const filePath = String(req.body?.filePath ?? "").trim();
            const line = Number(req.body?.line ?? 0);
            const requestedEndLine = Number(req.body?.endLine ?? line);
            const endLine = Number.isInteger(requestedEndLine) && requestedEndLine >= line
                ? requestedEndLine
                : line;
            const left = req.body?.side === "left";
            if (filePath && Number.isInteger(line) && line > 0) {
                // Azure anchors a whole-line comment from offset 1 to "end of line".
                payload.threadContext = {
                    filePath: `/${filePath.replace(/^\//, "")}`,
                    [left ? "leftFileStart" : "rightFileStart"]: { line, offset: 1 },
                    [left ? "leftFileEnd" : "rightFileEnd"]: {
                        line: endLine,
                        offset: 2147483647,
                    },
                };
            }
            await azureJson("POST", `${base}/threads?api-version=${AZURE_API_VERSION}`, JSON.stringify(payload));
            return resp.type("application/json").send({ ok: true });
        }
        catch (err) {
            return resp
                .status(400)
                .type("application/json")
                .send({ error: err.message });
        }
    });
    // Resolves, reactivates or closes a comment thread.
    app.post("/api/azure-devops/pullrequests/:id/threads/:threadId/status", async (req, resp) => {
        try {
            const status = String(req.body?.status ?? "");
            if (!(status in AZURE_THREAD_STATUSES) || status === "unknown") {
                return resp
                    .status(400)
                    .type("application/json")
                    .send({ error: `Unknown thread status "${status}".` });
            }
            const { base } = await azurePrApiBase(Number(req.params?.id));
            await azureJson("PATCH", `${base}/threads/${Number(req.params?.threadId)}?api-version=${AZURE_API_VERSION}`, JSON.stringify({ status: AZURE_THREAD_STATUSES[status] }));
            return resp.type("application/json").send({ ok: true });
        }
        catch (err) {
            return resp
                .status(400)
                .type("application/json")
                .send({ error: err.message });
        }
    });
    // Changed files of the latest PR iteration (names and change types only;
    // content is fetched per file on demand by /file-diff).
    app.get("/api/azure-devops/pullrequests/:id/changes", async (req, resp) => {
        try {
            const { base } = await azurePrApiBase(Number(req.params?.id));
            const iterations = await azureJson("GET", `${base}/iterations?api-version=${AZURE_API_VERSION}`);
            const list = Array.isArray(iterations?.value) ? iterations.value : [];
            const latest = list.length
                ? list.reduce((newest, entry) => String(entry?.createdDate ?? "") >
                    String(newest?.createdDate ?? "")
                    ? entry
                    : newest)
                : null;
            if (!latest) {
                return resp.type("application/json").send({ files: [] });
            }
            const changeStatus = {
                add: "added",
                edit: "modified",
                rename: "renamed",
                delete: "deleted",
                undelete: "added",
            };
            // Azure returns the changed files under "changeEntries" and pages
            // them (nextSkip); some releases use "value" instead. Follow the
            // paging until every page has been read, otherwise a PR with more
            // changes than one page would show none at all.
            const entries = [];
            let skip = 0;
            for (;;) {
                const data = await azureJson("GET", `${base}/iterations/${latest.id}/changes?$top=1000&$skip=${skip}&api-version=${AZURE_API_VERSION}`);
                const page = Array.isArray(data?.changeEntries)
                    ? data.changeEntries
                    : Array.isArray(data?.value)
                        ? data.value
                        : [];
                entries.push(...page);
                const nextSkip = Number(data?.nextSkip);
                if (Number.isInteger(nextSkip) && nextSkip > skip && page.length) {
                    skip = nextSkip;
                    continue;
                }
                if (page.length >= 1000) {
                    skip += 1000;
                    continue;
                }
                break;
            }
            const files = entries
                .filter((entry) => entry?.item?.isFolder !== true)
                .map((entry) => {
                const path = String(entry?.item?.path ?? "").replace(/^\//, "");
                const changeType = changeStatus[String(entry?.changeType ?? "")] ?? "modified";
                const oldPath = changeType === "renamed"
                    ? String(entry?.sourceServerItem ?? "").replace(/^\//, "")
                    : "";
                return { path, oldPath, changeType };
            })
                .filter((file) => Boolean(file.path));
            return resp.type("application/json").send({ files });
        }
        catch (err) {
            return resp
                .status(400)
                .type("application/json")
                .send({ error: err.message });
        }
    });
    /** Maps a policy evaluation status state onto the four UI states. */
    const azurePolicyState = (state) => {
        switch (String(state ?? "").toLowerCase()) {
            case "approved":
                return "succeeded";
            case "rejected":
            case "broken":
                return "failed";
            case "notapplicable":
                return "notApplicable";
            default:
                // pending, deferred, queued and unknown states all still gate merges.
                return "pending";
        }
    };
    /** Maps a native PR status state onto the four UI states. */
    const azureStatusState = (state) => {
        switch (String(state ?? "").toLowerCase()) {
            case "succeeded":
                return "succeeded";
            case "failed":
            case "error":
                return "failed";
            default:
                // notSet and pending: posted but undecided.
                return "pending";
        }
    };
    /** Reads every policy evaluation of one pull request (paged). */
    const fetchPolicyEvaluations = async (prefix, projectId, prId) => {
        if (!projectId || !prId) {
            throw new Error("The pull request does not expose its project identity.");
        }
        // The artifact id Azure keys policy evaluations by. The documented
        // template is "CodeReviewId"; the "CodeReviewIdentity" spelling is
        // rejected with an artifact-not-found 404 (verified against TFS).
        const artifactId = `vstfs:///CodeReview/CodeReviewId/${projectId}/${prId}`;
        const evaluations = [];
        let skip = 0;
        for (;;) {
            const data = await azureJson("GET", `${prefix}/_apis/policy/evaluations?artifactId=${encodeURIComponent(artifactId)}` +
                `&$skip=${skip}&$top=1000&api-version=5.0-preview.1`);
            // Versions disagree on the envelope: "evaluations" (preview shape), the
            // generic "count"/"value" list (seen live on TFS 5.0-preview.1) or a
            // bare array.
            let page = [];
            if (Array.isArray(data)) {
                page = data;
            }
            else if (Array.isArray(data?.evaluations)) {
                page = data.evaluations;
            }
            else if (Array.isArray(data?.value)) {
                page = data.value;
            }
            const before = evaluations.length;
            evaluations.push(...page);
            const total = Number(data?.count);
            const nextSkip = Number(data?.nextSkip);
            const moreByCount = Number.isInteger(total) && total > evaluations.length;
            const moreBySkip = Number.isInteger(nextSkip) && nextSkip > skip && page.length > 0;
            // Stop when complete, when a page added nothing new (the server ignored
            // our skip) or after a safety-capped number of pages.
            if (!(moreByCount || moreBySkip) || evaluations.length === before) {
                break;
            }
            skip =
                Number.isInteger(nextSkip) && nextSkip > skip
                    ? nextSkip
                    : evaluations.length;
            if (skip > 20000) {
                break;
            }
        }
        return evaluations;
    };
    /** Reads the native statuses posted directly on the pull request. */
    const fetchPullRequestStatuses = async (base) => {
        const data = await azureJson("GET", `${base}/statuses?api-version=5.0-preview.1`);
        return Array.isArray(data?.value) ? data.value : [];
    };
    /** Turns one policy evaluation into a check row (null when unnameable). */
    const policyCheckOf = (prefix, evaluation, index) => {
        const configuration = evaluation?.configuration ?? {};
        const type = configuration.type ?? {};
        const settings = configuration.settings ?? {};
        const context = evaluation?.context ?? {};
        const status = evaluation?.status;
        // 5.0-preview answers status as a plain state string; newer versions may
        // answer a { state, message } object. Support both.
        const state = typeof status === "string" ? status : status?.state;
        const message = typeof status === "string" ? "" : status?.message;
        const typeName = String(type?.displayName ?? "").trim();
        const isBuild = /build/i.test(typeName);
        const name = String(settings?.displayName ?? "").trim() ||
            (isBuild ? String(context?.buildDefinitionName ?? "").trim() : "") ||
            typeName ||
            "Policy";
        if (!name) {
            return null;
        }
        const gate = `${typeName} ${name}`;
        const buildId = Number(context?.buildId ?? settings?.buildId);
        const check = {
            id: `policy:${evaluation?.evaluationId ?? status?.evaluationId ?? index}`,
            name,
            kind: /build/i.test(gate)
                ? "build"
                : /reviewer/i.test(gate)
                    ? "reviewer"
                    : "policy",
            state: azurePolicyState(state),
            required: configuration?.isBlocking === true ||
                configuration?.isRequired === true,
        };
        const detail = String(message ?? "").trim();
        if (detail) {
            check.detail = detail;
        }
        if (context?.isExpired === true) {
            check.detail = detail ? `${detail} (build expired)` : "Build expired";
        }
        if (Number.isInteger(buildId) && buildId > 0) {
            check.url = `${prefix}/_build/results?buildId=${buildId}`;
        }
        return check;
    };
    // Related work items of the pull request, resolved to title/state through
    // the work-item batch API. Unresolvable refs degrade to an id-only row.
    app.get("/api/azure-devops/pullrequests/:id/workitems", async (req, resp) => {
        try {
            const { base, prefix } = await azurePrApiBase(Number(req.params?.id));
            const refs = await azureJson("GET", `${base}/workitems?api-version=${AZURE_API_VERSION}`);
            const ids = [
                ...new Set((Array.isArray(refs?.value) ? refs.value : [])
                    .map((entry) => Number(entry?.id))
                    .filter((id) => Number.isInteger(id) && id > 0)),
            ];
            if (!ids.length) {
                return resp.type("application/json").send({ workItems: [] });
            }
            const batch = await azureRequest("GET", `${prefix}/_apis/wit/workitems?ids=${ids.join(",")}` +
                `&fields=System.Id,System.Title,System.State&api-version=${AZURE_API_VERSION}`, "");
            const details = new Map();
            if (batch.status >= 200 && batch.status < 300) {
                const data = JSON.parse(batch.body);
                for (const item of Array.isArray(data?.value) ? data.value : []) {
                    details.set(String(item?.id ?? ""), {
                        title: String(item?.fields?.["System.Title"] ?? ""),
                        state: String(item?.fields?.["System.State"] ?? ""),
                    });
                }
            }
            const workItems = ids.map((id) => ({
                id,
                title: details.get(String(id))?.title || `Work item ${id}`,
                state: details.get(String(id))?.state ?? "",
                url: `${prefix}/_workitems/edit/${id}`,
            }));
            return resp.type("application/json").send({ workItems });
        }
        catch (err) {
            return resp
                .status(400)
                .type("application/json")
                .send({ error: err.message });
        }
    });
    // Tags are the PR labels resource; the side panel adds and removes them
    // directly, so both directions are served here.
    app.post("/api/azure-devops/pullrequests/:id/labels", async (req, resp) => {
        try {
            const name = String(req.body?.name ?? "").trim();
            if (!name) {
                return resp
                    .status(400)
                    .type("application/json")
                    .send({ error: "A tag name is required." });
            }
            const { base } = await azurePrApiBase(Number(req.params?.id));
            await azureJson("POST", `${base}/labels?api-version=${AZURE_API_VERSION}`, JSON.stringify({ name }));
            return resp.type("application/json").send({ success: true });
        }
        catch (err) {
            return resp
                .status(400)
                .type("application/json")
                .send({ error: err.message });
        }
    });
    app.delete("/api/azure-devops/pullrequests/:id/labels/:name", async (req, resp) => {
        try {
            const name = String(req.params?.name ?? "");
            if (!name) {
                return resp
                    .status(400)
                    .type("application/json")
                    .send({ error: "A tag name is required." });
            }
            const { base } = await azurePrApiBase(Number(req.params?.id));
            await azureJson("DELETE", `${base}/labels/${encodeURIComponent(name)}?api-version=${AZURE_API_VERSION}`, "");
            return resp.type("application/json").send({ success: true });
        }
        catch (err) {
            return resp
                .status(400)
                .type("application/json")
                .send({ error: err.message });
        }
    });
    // Work items are linked from the work item side: the link lives on the work
    // item as an ArtifactLink relation pointing at the PR's artifact URI, so
    // linking and unlinking both patch the work item rather than the PR.
    app.post("/api/azure-devops/pullrequests/:id/workitems", async (req, resp) => {
        try {
            const workItemId = Number(req.body?.id);
            if (!Number.isInteger(workItemId) || workItemId <= 0) {
                return resp
                    .status(400)
                    .type("application/json")
                    .send({ error: "A work item id is required." });
            }
            const { prefix, artifactUrl } = await azurePrArtifactOf(Number(req.params?.id));
            const alreadyLinked = (await azureWorkItemRelations(prefix, workItemId)).some((relation) => String(relation?.url ?? "").toLowerCase() ===
                artifactUrl.toLowerCase());
            if (!alreadyLinked) {
                await azurePatchWorkItemRelations(prefix, workItemId, [
                    {
                        op: "add",
                        path: "/relations/-",
                        value: {
                            rel: "ArtifactLink",
                            url: artifactUrl,
                            attributes: { name: "Pull Request" },
                        },
                    },
                ]);
            }
            return resp.type("application/json").send({ success: true });
        }
        catch (err) {
            return resp
                .status(400)
                .type("application/json")
                .send({ error: err.message });
        }
    });
    app.delete("/api/azure-devops/pullrequests/:id/workitems/:workItemId", async (req, resp) => {
        try {
            const workItemId = Number(req.params?.workItemId);
            if (!Number.isInteger(workItemId) || workItemId <= 0) {
                return resp
                    .status(400)
                    .type("application/json")
                    .send({ error: "A work item id is required." });
            }
            const { prefix, artifactUrl } = await azurePrArtifactOf(Number(req.params?.id));
            // Relations are removed by index, so confirm the link and its index in
            // the same read, then assert that url at the index before removing:
            // Azure applies the patch atomically, so a relation list that moved
            // underneath this call is rejected instead of removing a neighbour.
            const relations = await azureWorkItemRelations(prefix, workItemId);
            const index = relations.findIndex((relation) => String(relation?.url ?? "").toLowerCase() ===
                artifactUrl.toLowerCase());
            if (index >= 0) {
                await azurePatchWorkItemRelations(prefix, workItemId, [
                    {
                        op: "test",
                        path: `/relations/${index}/url`,
                        value: String(relations[index]?.url ?? ""),
                    },
                    { op: "remove", path: `/relations/${index}` },
                ]);
            }
            return resp.type("application/json").send({ success: true });
        }
        catch (err) {
            return resp
                .status(400)
                .type("application/json")
                .send({ error: err.message });
        }
    });
    // Merge gates of the pull request: Azure policy evaluations (builds,
    // required reviewers, comments, work items, ...) plus the native statuses
    // posted on the PR. One failing source degrades to a warning so the other
    // still reaches the dialog; only when both fail is the request an error.
    app.get("/api/azure-devops/pullrequests/:id/checks", async (req, resp) => {
        const describe = (error) => error instanceof Error ? error.message : String(error);
        try {
            const { base, prefix } = await azurePrApiBase(Number(req.params?.id));
            const pr = await azureJson("GET", `${base}?api-version=${AZURE_API_VERSION}`);
            const warnings = [];
            const checks = new Map();
            const [evaluations, statuses] = await Promise.all([
                fetchPolicyEvaluations(prefix, String(pr?.repository?.project?.id ?? ""), Number(pr?.pullRequestId ?? 0)).catch((error) => ({ error })),
                fetchPullRequestStatuses(base).catch((error) => ({ error })),
            ]);
            const policyError = "error" in evaluations ? evaluations.error : null;
            const statusError = "error" in statuses ? statuses.error : null;
            if (policyError && statusError) {
                throw new Error(`Policy evaluations failed (${describe(policyError)}); pull request statuses failed (${describe(statusError)}).`);
            }
            if (policyError) {
                warnings.push(`Policy evaluations are unavailable (${describe(policyError)}). Showing pull request statuses only.`);
            }
            else {
                evaluations.forEach((evaluation, index) => {
                    const check = policyCheckOf(prefix, evaluation, index);
                    if (check) {
                        checks.set(check.id, check);
                    }
                });
            }
            if (statusError) {
                warnings.push(`Pull request statuses are unavailable (${describe(statusError)}). Showing policy evaluations only.`);
            }
            else {
                // Statuses repeat on re-post; keep only the latest per genre/name.
                const latestStatuses = new Map();
                for (const status of statuses) {
                    const key = `${String(status?.context?.genre ?? "")}/${String(status?.context?.name ?? "")}`;
                    const existing = latestStatuses.get(key);
                    if (!existing ||
                        String(status?.creationDate ?? "") >
                            String(existing?.creationDate ?? "")) {
                        latestStatuses.set(key, status);
                    }
                }
                for (const [key, status] of latestStatuses) {
                    const name = String(status?.context?.name ?? "Status");
                    const row = {
                        id: `status:${key}`,
                        name,
                        kind: "status",
                        state: azureStatusState(status?.state),
                        required: false,
                    };
                    const description = String(status?.description ?? "").trim();
                    if (description) {
                        row.detail = description;
                    }
                    const target = String(status?.targetUrl ?? "");
                    if (target) {
                        row.url = target;
                    }
                    checks.set(row.id, row);
                }
            }
            return resp
                .type("application/json")
                .send({ checks: [...checks.values()], warnings });
        }
        catch (err) {
            return resp
                .status(400)
                .type("application/json")
                .send({ error: err.message });
        }
    });
    // Abandons (closes) the pull request without merging.
    app.post("/api/azure-devops/pullrequests/:id/abandon", async (req, resp) => {
        try {
            const { base } = await azurePrApiBase(Number(req.params?.id));
            await azureJson("PATCH", `${base}?api-version=${AZURE_API_VERSION}`, JSON.stringify({ status: "abandoned" }));
            return resp.type("application/json").send({ ok: true });
        }
        catch (err) {
            return resp
                .status(400)
                .type("application/json")
                .send({ error: err.message });
        }
    });
    // Unified diff of one PR file, computed from the Azure item contents at the
    // PR merge commits. source/target are optional overrides; default comes from
    // the pull request detail.
    app.get("/api/azure-devops/pullrequests/:id/file-diff", async (req, resp) => {
        try {
            const path = String(req.query?.path ?? "").replace(/^\//, "");
            if (!path) {
                return resp
                    .status(400)
                    .type("application/json")
                    .send({ error: "path required" });
            }
            const oldPath = String(req.query?.oldPath ?? "").replace(/^\//, "");
            const { base, prefix, repo } = await azurePrApiBase(Number(req.params?.id));
            let source = String(req.query?.source ?? "");
            let target = String(req.query?.target ?? "");
            if (!source || !target) {
                const pr = await azureJson("GET", `${base}?api-version=${AZURE_API_VERSION}`);
                source = source || String(pr?.lastMergeSourceCommit?.commitId ?? "");
                target = target || String(pr?.lastMergeTargetCommit?.commitId ?? "");
            }
            if (!source || !target) {
                throw new Error("The pull request does not have merge commits to diff yet.");
            }
            const fetchContent = async (itemPath, commit) => {
                if (!itemPath)
                    return { content: "", binary: false };
                const url = `${prefix}/_apis/git/repositories/${encodeURIComponent(repo)}/items` +
                    `?path=${encodeURIComponent(`/${itemPath}`)}` +
                    `&versionDescriptor.version=${encodeURIComponent(commit)}` +
                    `&versionDescriptor.versionType=commit&includeContent=true` +
                    `&api-version=${AZURE_API_VERSION}`;
                const result = await azureRequest("GET", url, "");
                // 404/203: the file does not exist at that commit (added/deleted file).
                if (result.status === 404 || result.status === 203) {
                    return { content: "", binary: false };
                }
                if (result.status < 200 || result.status >= 300) {
                    throw new Error(azureErrorMessage(result) ||
                        `Azure DevOps returned HTTP ${result.status}.`);
                }
                let data = null;
                try {
                    data = JSON.parse(result.body);
                }
                catch {
                    // Depending on the Azure deployment and file type, the Items API
                    // may return the file body directly instead of a JSON envelope.
                }
                const hasContentEnvelope = data !== null &&
                    typeof data === "object" &&
                    (Object.prototype.hasOwnProperty.call(data, "content") ||
                        Object.prototype.hasOwnProperty.call(data, "isBinary"));
                return {
                    content: hasContentEnvelope
                        ? typeof data.content === "string"
                            ? data.content
                            : ""
                        : result.body,
                    binary: hasContentEnvelope && data.isBinary === true,
                };
            };
            const [oldFile, newFile] = await Promise.all([
                fetchContent(oldPath || path, target),
                fetchContent(path, source),
            ]);
            if (oldFile.binary || newFile.binary) {
                return resp.type("application/json").send({
                    path,
                    oldPath,
                    status: "binary",
                    binary: true,
                    additions: 0,
                    deletions: 0,
                    lines: [],
                });
            }
            const status = String(req.query?.changeType ?? "") ||
                (!oldFile.content
                    ? "added"
                    : !newFile.content
                        ? "deleted"
                        : "modified");
            // jsdiff omits the "diff --git" header parseUnifiedDiff expects, and
            // prefixing it lets the same parser serve both local and PR diffs.
            const patch = createTwoFilesPatch(`a/${oldPath || path}`, `b/${path}`, oldFile.content, newFile.content);
            const raw = `diff --git a/${oldPath || path} b/${path}\n${patch.replace(/^=+\n/, "")}`;
            // The patch's trailing newline would surface as a phantom context row.
            const [file] = parseUnifiedDiff(raw.replace(/\n+$/, ""));
            const maxLines = 10000;
            const lines = (file?.lines ?? []).slice(0, maxLines);
            if ((file?.lines ?? []).length > maxLines) {
                lines.push({
                    type: "hunk",
                    text: "Diff truncated (file too large).",
                });
            }
            return resp.type("application/json").send({
                path,
                oldPath,
                status,
                binary: false,
                additions: file?.additions ?? 0,
                deletions: file?.deletions ?? 0,
                originalContent: oldFile.content,
                modifiedContent: newFile.content,
                lines,
            });
        }
        catch (err) {
            return resp
                .status(400)
                .type("application/json")
                .send({ error: err.message });
        }
    });
    // ==================== Commit Detail ====================
    app.post("/api/commit/detail", async (req, resp) => {
        try {
            const { hash } = req.body;
            if (!hash) {
                return resp
                    .status(400)
                    .type("application/json")
                    .send({ error: "hash required" });
            }
            // Fields are NUL-separated; %b may span lines and contain anything
            // except NUL, so it cannot be split naively by newline.
            const raw = await git.raw([
                "show",
                "-s",
                "--format=%H%x00%aI%x00%s%x00%b%x00%aN%x00%aE%x00%P",
                hash,
            ]);
            const [fullHash, date, message, body, authorName, authorEmail, parents] = raw.trimEnd().split("\u0000");
            return resp.type("application/json").send({
                hash: fullHash,
                date,
                message,
                refs: "",
                body: body ?? "",
                ...authorIdentity(authorName, authorEmail, await configuredIdentity()),
                parents: String(parents ?? "")
                    .split(" ")
                    .filter(Boolean),
            });
        }
        catch (err) {
            return resp
                .status(400)
                .type("application/json")
                .send({ error: err.message });
        }
    });
    // ==================== Diff Viewer ====================
    app.post("/api/commit/diff", async (req, resp) => {
        try {
            const { hash } = req.body;
            if (!hash) {
                return resp
                    .status(400)
                    .type("application/json")
                    .send({ error: "hash required" });
            }
            // Get the raw unified diff (diff against the first parent for merges)
            const rawDiff = await git.raw([
                "show",
                "--no-color",
                "--pretty=format:",
                "--find-renames",
                "--first-parent",
                "-m",
                hash,
            ]);
            return resp
                .type("application/json")
                .send({ hash, files: parseUnifiedDiff(rawDiff) });
        }
        catch (err) {
            return resp
                .status(400)
                .type("application/json")
                .send({ error: err.message });
        }
    });
    // ==================== Working Changes ====================
    app.get("/api/working-changes", async (_req, resp) => {
        try {
            await mutationQueue;
            return resp.type("application/json").send(await working.snapshot());
        }
        catch (err) {
            return resp
                .status(400)
                .type("application/json")
                .send({ error: err.message });
        }
    });
    // ==================== File Content ====================
    app.post("/api/file-content", async (req, resp) => {
        try {
            const { path, ref } = req.body;
            if (!path || !ref) {
                return resp
                    .status(400)
                    .type("application/json")
                    .send({ error: "path and ref required" });
            }
            if (ref === "WORKING") {
                const root = await repoRoot();
                const abs = resolve(root, path);
                const rel = relative(root, abs);
                if (rel === ".." || rel.startsWith(`..${sep}`) || isAbsolute(rel)) {
                    return resp
                        .status(400)
                        .type("application/json")
                        .send({ error: "invalid path" });
                }
                try {
                    const buffer = await readFile(abs);
                    if (buffer.includes(0)) {
                        return resp
                            .type("application/json")
                            .send({ binary: true, content: "" });
                    }
                    return resp
                        .type("application/json")
                        .send({ content: buffer.toString("utf8") });
                }
                catch {
                    // File no longer exists on disk (deleted).
                    return resp.type("application/json").send({ content: "" });
                }
            }
            if (ref === "EMPTY") {
                return resp.type("application/json").send({ content: "" });
            }
            try {
                const content = await git.raw([
                    "show",
                    ref === "INDEX" ? `:${path}` : `${ref}:${path}`,
                ]);
                if (content.includes("\u0000")) {
                    return resp
                        .type("application/json")
                        .send({ binary: true, content: "" });
                }
                return resp.type("application/json").send({ content });
            }
            catch {
                // Path did not exist at that revision (added file).
                return resp.type("application/json").send({ content: "" });
            }
        }
        catch (err) {
            return resp
                .status(400)
                .type("application/json")
                .send({ error: err.message });
        }
    });
    // ==================== Discard ====================
    app.post("/api/discard", async (req, resp) => {
        try {
            const { files, mode } = req.body;
            if (!Array.isArray(files) || files.length === 0) {
                return resp
                    .status(400)
                    .type("application/json")
                    .send({ error: "files required" });
            }
            const root = await repoRoot();
            const status = await git.status();
            const untracked = new Set(status.not_added ?? []);
            const tracked = files.filter((file) => !untracked.has(file));
            const removed = files.filter((file) => untracked.has(file));
            if (tracked.length > 0) {
                if (mode === "unstaged") {
                    // Restore from the index so staged changes survive; unmerged (conflicted)
                    // paths cannot be restored from the index and fall back to HEAD.
                    const conflicted = new Set(status.conflicted ?? []);
                    const restorable = tracked.filter((file) => !conflicted.has(file));
                    const unmerged = tracked.filter((file) => conflicted.has(file));
                    if (restorable.length > 0)
                        await git.raw(["checkout", "--", ...restorable]);
                    if (unmerged.length > 0)
                        await git.raw(["checkout", "HEAD", "--", ...unmerged]);
                }
                else {
                    await git.raw(["checkout", "HEAD", "--", ...tracked]);
                }
            }
            for (const file of removed) {
                await rm(join(root, file), { force: true, recursive: true });
            }
            return resp.type("application/json").send({ success: true });
        }
        catch (err) {
            return resp
                .status(400)
                .type("application/json")
                .send({ error: err.message });
        }
    });
    // ==================== Working Tree Actions ====================
    app.post("/api/reset", async (_req, resp) => {
        try {
            await git.raw(["reset", "--hard", "HEAD"]);
            return resp.type("application/json").send({ ok: true });
        }
        catch (err) {
            return resp
                .status(400)
                .type("application/json")
                .send({ error: err.message });
        }
    });
    app.post("/api/clean", async (_req, resp) => {
        try {
            await git.raw(["clean", "-fd"]);
            return resp.type("application/json").send({ ok: true });
        }
        catch (err) {
            return resp
                .status(400)
                .type("application/json")
                .send({ error: err.message });
        }
    });
    const address = await app.listen({ port, ...(host ? { host } : {}) });
    return {
        address,
        close: () => app.close(),
        updateSettings: (settings) => {
            azureDevOpsUrl = settings.azureDevOpsUrl;
            prBranchNameTemplate = settings.prBranchNameTemplate;
            autoReload = settings.autoReload;
            diffViewer = settings.diffViewer;
            showGraph = settings.showGraph;
            showStashes = settings.showStashes;
            fileListView = settings.fileListView;
            searchMode = settings.searchMode;
            searchCaseSensitive = settings.searchCaseSensitive;
            showTags = settings.showTags;
            showRemoteBranches = settings.showRemoteBranches;
            issueRegex = settings.issueRegex;
            issueUrl = settings.issueUrl;
            allowMerge = settings.allowMerge;
        },
    };
}
