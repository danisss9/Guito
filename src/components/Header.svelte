<script lang="ts">
  import IconButton from '@smui/icon-button';
  import Tooltip, { Wrapper } from '@smui/tooltip';

  export let loadData: () => void;
  export let onCommit: () => void;
  export let onAmend: () => void;
  export let onStage: () => void;
  export let onBranches: () => void;
  export let onStash: () => void;
  export let onTags: () => void;
  export let onRevert: () => void;
  export let onMerge: () => void;
  export let onRebase: () => void;
  export let onPull: () => void;
  export let onPush: () => void;
  export let onFetch: () => void;
  export let currentBranch = 'main';

  async function fetchGit() {
    await onFetch();
    await loadData();
  }
</script>

<IconButton class="material-icons">menu</IconButton>
<h2>Guito</h2>
<span style="margin-left: 20px; color: #666; font-size: 0.9rem;">
  <strong>Branch:</strong>
  {currentBranch}
</span>

<div class="right-toolbar">
  <div class="toolbar-group">
    <h4 style="margin: 0 10px; color: #999; font-size: 0.75rem; text-transform: uppercase;">
      Staging
    </h4>
    <Wrapper>
      <IconButton class="material-icons" on:click={onStage} title="Stage/unstage files">
        check_circle
      </IconButton>
      <Tooltip>Stage/Unstage Files</Tooltip>
    </Wrapper>
  </div>

  <div style="width: 1px; height: 24px; background: #ddd; margin: 0 8px;"></div>

  <div class="toolbar-group">
    <h4 style="margin: 0 10px; color: #999; font-size: 0.75rem; text-transform: uppercase;">
      Commits
    </h4>
    <Wrapper>
      <IconButton class="material-icons" on:click={onCommit} title="Create commit">
        note_add
      </IconButton>
      <Tooltip>Commit</Tooltip>
    </Wrapper>
    <Wrapper>
      <IconButton class="material-icons" on:click={onAmend} title="Amend last commit">
        edit
      </IconButton>
      <Tooltip>Amend</Tooltip>
    </Wrapper>
    <Wrapper>
      <IconButton class="material-icons" on:click={onRevert} title="Revert commit">undo</IconButton>
      <Tooltip>Revert</Tooltip>
    </Wrapper>
  </div>

  <div style="width: 1px; height: 24px; background: #ddd; margin: 0 8px;"></div>

  <div class="toolbar-group">
    <h4 style="margin: 0 10px; color: #999; font-size: 0.75rem; text-transform: uppercase;">
      Branches
    </h4>
    <Wrapper>
      <IconButton class="material-icons" on:click={onBranches} title="Manage branches">
        fork
      </IconButton>
      <Tooltip>Branches</Tooltip>
    </Wrapper>
    <Wrapper>
      <IconButton class="material-icons" on:click={onMerge} title="Merge branch">merge</IconButton>
      <Tooltip>Merge</Tooltip>
    </Wrapper>
    <Wrapper>
      <IconButton class="material-icons" on:click={onRebase} title="Rebase branch">
        update
      </IconButton>
      <Tooltip>Rebase</Tooltip>
    </Wrapper>
  </div>

  <div style="width: 1px; height: 24px; background: #ddd; margin: 0 8px;"></div>

  <div class="toolbar-group">
    <h4 style="margin: 0 10px; color: #999; font-size: 0.75rem; text-transform: uppercase;">
      Stash & Tags
    </h4>
    <Wrapper>
      <IconButton class="material-icons" on:click={onStash} title="Manage stashes">
        inventory_2
      </IconButton>
      <Tooltip>Stash</Tooltip>
    </Wrapper>
    <Wrapper>
      <IconButton class="material-icons" on:click={onTags} title="Manage tags">label</IconButton>
      <Tooltip>Tags</Tooltip>
    </Wrapper>
  </div>

  <div style="width: 1px; height: 24px; background: #ddd; margin: 0 8px;"></div>

  <div class="toolbar-group">
    <h4 style="margin: 0 10px; color: #999; font-size: 0.75rem; text-transform: uppercase;">
      Remote
    </h4>
    <Wrapper>
      <IconButton class="material-icons" on:click={onFetch} title="Fetch from remote">
        cloud_sync
      </IconButton>
      <Tooltip>Fetch</Tooltip>
    </Wrapper>
    <Wrapper>
      <IconButton class="material-icons" on:click={onPull} title="Pull from remote">
        cloud_download
      </IconButton>
      <Tooltip>Pull</Tooltip>
    </Wrapper>
    <Wrapper>
      <IconButton class="material-icons" on:click={onPush} title="Push to remote">
        cloud_upload
      </IconButton>
      <Tooltip>Push</Tooltip>
    </Wrapper>
  </div>
</div>

<style>
  .right-toolbar {
    display: flex;
    align-items: center;
    margin-left: auto;
    gap: 4px;
  }

  .toolbar-group {
    display: flex;
    align-items: center;
    gap: 4px;
  }
</style>
