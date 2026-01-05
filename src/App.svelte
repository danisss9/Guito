<script lang="ts">
  import { onMount } from 'svelte';
  import Header from './components/Header.svelte';
  import CommitTable from './components/CommitTable.svelte';
  import CommitDialog from './components/CommitDialog.svelte';
  import BranchManager from './components/BranchManager.svelte';
  import StashManager from './components/StashManager.svelte';
  import TagManager from './components/TagManager.svelte';
  import StageChanges from './components/StageChanges.svelte';
  import CommitDiffViewer from './components/CommitDiffViewer.svelte';
  import type { Commit } from './model/commit';
  import type { BranchSummary } from './model/branch';
  import type { StashListSummary } from './model/stash';
  import type { StatusSummary } from './model/status';

  let data: Commit[];
  let branches: BranchSummary | null = null;
  let stashes: StashListSummary | null = null;
  let tags: string[] = [];
  let status: StatusSummary | null = null;
  let currentBranch = 'main';

  // Dialog states
  let commitDialogOpen = false;
  let commitDialogIsAmend = false;
  let branchManagerOpen = false;
  let stashManagerOpen = false;
  let tagManagerOpen = false;
  let stageChangesOpen = false;
  let diffViewerOpen = false;
  let selectedCommitForDiff: Commit | null = null;

  onMount(async () => {
    await loadData();
    await loadBranches();
    await loadStashes();
    await loadTags();
    await loadStatus();
  });

  async function loadData() {
    const resp = await fetch('http://localhost:8080/api/commits', { method: 'GET' });
    data = resp.ok ? await resp.json() : [];
  }

  async function loadBranches() {
    try {
      const resp = await fetch('http://localhost:8080/api/branches', { method: 'GET' });
      if (resp.ok) {
        branches = await resp.json();
        currentBranch = branches?.current || 'main';
      }
    } catch (err) {
      console.error('Failed to load branches:', err);
    }
  }

  async function loadStashes() {
    try {
      const resp = await fetch('http://localhost:8080/api/stash/list', { method: 'GET' });
      if (resp.ok) {
        stashes = await resp.json();
      }
    } catch (err) {
      console.error('Failed to load stashes:', err);
    }
  }

  async function loadTags() {
    try {
      const resp = await fetch('http://localhost:8080/api/tags', { method: 'GET' });
      if (resp.ok) {
        const result = await resp.json();
        tags = result.all || [];
      }
    } catch (err) {
      console.error('Failed to load tags:', err);
    }
  }

  async function loadStatus() {
    try {
      const resp = await fetch('http://localhost:8080/api/status', { method: 'GET' });
      if (resp.ok) {
        status = await resp.json();
      }
    } catch (err) {
      console.error('Failed to load status:', err);
    }
  }

  // Commit operations
  async function handleCommit(message: string, description: string) {
    const resp = await fetch('http://localhost:8080/api/commit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message, description }),
    });
    if (!resp.ok) throw new Error('Commit failed');
    await loadData();
    await loadStatus();
  }

  async function handleAmend(message: string, description: string) {
    const resp = await fetch('http://localhost:8080/api/amend', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message, description }),
    });
    if (!resp.ok) throw new Error('Amend failed');
    await loadData();
  }

  async function handleRevert(commit: string) {
    const commitHash = prompt('Enter commit hash to revert:');
    if (commitHash) {
      const resp = await fetch('http://localhost:8080/api/revert', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ commit: commitHash }),
      });
      if (!resp.ok) throw new Error('Revert failed');
      await loadData();
    }
  }

  // Branch operations
  async function handleCheckoutBranch(branch: string) {
    const resp = await fetch('http://localhost:8080/api/checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ref: branch }),
    });
    if (!resp.ok) throw new Error('Checkout failed');
    await loadBranches();
    await loadData();
    await loadStatus();
  }

  async function handleDeleteBranch(branch: string) {
    const resp = await fetch('http://localhost:8080/api/branch/delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: branch, force: false }),
    });
    if (!resp.ok) throw new Error('Delete branch failed');
    await loadBranches();
  }

  async function handleCreateBranch() {
    const name = prompt('Enter new branch name:');
    if (name) {
      const resp = await fetch('http://localhost:8080/api/branch/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, startPoint: undefined }),
      });
      if (!resp.ok) throw new Error('Create branch failed');
      await loadBranches();
    }
  }

  async function handleMerge() {
    const branch = prompt('Enter branch to merge:');
    if (branch) {
      const resp = await fetch('http://localhost:8080/api/merge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ branch }),
      });
      if (!resp.ok) throw new Error('Merge failed');
      await loadData();
      await loadStatus();
    }
  }

  async function handleRebase() {
    const branch = prompt('Enter branch to rebase:');
    if (branch) {
      const resp = await fetch('http://localhost:8080/api/rebase', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ branch }),
      });
      if (!resp.ok) throw new Error('Rebase failed');
      await loadData();
      await loadStatus();
    }
  }

  // Staging operations
  async function handleStage(files: string[]) {
    const resp = await fetch('http://localhost:8080/api/stage', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ files }),
    });
    if (!resp.ok) throw new Error('Stage failed');
    await loadStatus();
  }

  async function handleUnstage(files: string[]) {
    const resp = await fetch('http://localhost:8080/api/unstage', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ files }),
    });
    if (!resp.ok) throw new Error('Unstage failed');
    await loadStatus();
  }

  // Stash operations
  async function handleSaveStash(message: string) {
    const resp = await fetch('http://localhost:8080/api/stash/save', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message }),
    });
    if (!resp.ok) throw new Error('Stash failed');
    await loadStashes();
    await loadStatus();
  }

  async function handleApplyStash(index: number) {
    const resp = await fetch('http://localhost:8080/api/stash/apply', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ index }),
    });
    if (!resp.ok) throw new Error('Apply stash failed');
    await loadStashes();
    await loadStatus();
  }

  async function handlePopStash(index: number) {
    const resp = await fetch('http://localhost:8080/api/stash/pop', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ index }),
    });
    if (!resp.ok) throw new Error('Pop stash failed');
    await loadStashes();
    await loadStatus();
  }

  async function handleDropStash(index: number) {
    const resp = await fetch('http://localhost:8080/api/stash/drop', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ index }),
    });
    if (!resp.ok) throw new Error('Drop stash failed');
    await loadStashes();
  }

  async function handleShowStash(index: number): Promise<string> {
    const resp = await fetch('http://localhost:8080/api/stash/show', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ index }),
    });
    if (!resp.ok) throw new Error('Show stash failed');
    const data = await resp.json();
    return data.preview || '';
  }

  // Tag operations
  async function handleCreateTag(name: string, message: string) {
    const resp = await fetch('http://localhost:8080/api/tag/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, message, commit: undefined }),
    });
    if (!resp.ok) throw new Error('Create tag failed');
    await loadTags();
  }

  async function handleDeleteTag(name: string) {
    const resp = await fetch('http://localhost:8080/api/tag/delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    });
    if (!resp.ok) throw new Error('Delete tag failed');
    await loadTags();
  }

  // Remote operations
  async function handleFetch() {
    const resp = await fetch('http://localhost:8080/api/fetch', { method: 'GET' });
    if (!resp.ok) throw new Error('Fetch failed');
    await loadBranches();
  }

  async function handlePull() {
    const resp = await fetch('http://localhost:8080/api/pull', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ remote: 'origin', branch: undefined }),
    });
    if (!resp.ok) throw new Error('Pull failed');
    await loadData();
    await loadStatus();
    await loadBranches();
  }

  async function handlePush() {
    const resp = await fetch('http://localhost:8080/api/push', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ remote: 'origin', branch: undefined, force: false }),
    });
    if (!resp.ok) throw new Error('Push failed');
  }

  async function handleShowCommitDiff(commit: Commit) {
    selectedCommitForDiff = commit;
    diffViewerOpen = true;
  }
</script>

<div class="main-container">
  <div class="header-container">
    <Header
      {loadData}
      {currentBranch}
      onCommit={() => {
        commitDialogIsAmend = false;
        commitDialogOpen = true;
      }}
      onAmend={() => {
        commitDialogIsAmend = true;
        commitDialogOpen = true;
      }}
      onStage={() => {
        stageChangesOpen = true;
      }}
      onBranches={() => {
        branchManagerOpen = true;
      }}
      onStash={() => {
        stashManagerOpen = true;
      }}
      onTags={() => {
        tagManagerOpen = true;
      }}
      onRevert={() => handleRevert('')}
      onMerge={handleMerge}
      onRebase={handleRebase}
      onPull={handlePull}
      onPush={handlePush}
      onFetch={handleFetch}
    />
  </div>
  <div class="content-container">
    <CommitTable {data} onSelectCommit={handleShowCommitDiff} />
  </div>
</div>

<CommitDialog
  bind:open={commitDialogOpen}
  isAmend={commitDialogIsAmend}
  onCommit={commitDialogIsAmend ? handleAmend : handleCommit}
/>

<BranchManager
  bind:open={branchManagerOpen}
  {branches}
  {currentBranch}
  onCheckout={handleCheckoutBranch}
  onDelete={handleDeleteBranch}
  onCreate={handleCreateBranch}
/>

<StashManager
  bind:open={stashManagerOpen}
  {stashes}
  onSave={handleSaveStash}
  onApply={handleApplyStash}
  onPop={handlePopStash}
  onDrop={handleDropStash}
  onShow={handleShowStash}
/>

<TagManager
  bind:open={tagManagerOpen}
  {tags}
  onCreateTag={handleCreateTag}
  onDeleteTag={handleDeleteTag}
/>

<StageChanges
  bind:open={stageChangesOpen}
  {status}
  onStage={handleStage}
  onUnstage={handleUnstage}
/>

<CommitDiffViewer
  bind:open={diffViewerOpen}
  commit={selectedCommitForDiff}
  onClose={() => {
    diffViewerOpen = false;
    selectedCommitForDiff = null;
  }}
/>

<style>
  .main-container {
    width: 100%;
    height: 100%;
    display: flex;
    flex-direction: column;
    align-items: stretch;
    padding: 0 10px;
    box-sizing: border-box;
  }

  .header-container {
    height: 60px;
    display: flex;
    align-items: center;
  }

  .content-container {
    flex: 1;
    overflow-y: auto;
  }
</style>
