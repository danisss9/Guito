<script lang="ts">
  import IconButton from '@smui/icon-button';
  import Tooltip, { Wrapper } from '@smui/tooltip';

  export let loadData: () => void;

  async function fetchGit() {
    const resp = await fetch('http://localhost:8080/api/fetch', { method: 'GET' });
    if (resp.ok) {
      await loadData();
    }
  }
</script>

<IconButton class="material-icons">menu</IconButton>
<h2>Easy Git Explorer</h2>

<div class="right-toolbar">
  <Wrapper>
    <IconButton class="material-icons">note_add</IconButton>
    <Tooltip>Commit changes</Tooltip>
  </Wrapper>
  <Wrapper>
    <IconButton class="material-icons">cloud_download</IconButton>
    <Tooltip>Pull from Remote</Tooltip>
  </Wrapper>
  <Wrapper>
    <IconButton class="material-icons">cloud_upload</IconButton>
    <Tooltip>Push to Remote</Tooltip>
  </Wrapper>
  <Wrapper>
    <IconButton class="material-icons" on:click={fetchGit}>cloud_sync</IconButton>
    <Tooltip>Fetch From Remote</Tooltip>
  </Wrapper>
  <Wrapper>
    <IconButton class="material-icons">settings</IconButton>
    <Tooltip>Settings</Tooltip>
  </Wrapper>
</div>

<style>
  .right-toolbar {
    display: flex;
    align-items: center;
    margin-left: auto;
  }
</style>
