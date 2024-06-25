<script lang="ts">
  import { onMount } from 'svelte';
  import Header from './components/Header.svelte';
  import CommitTable from './components/CommitTable.svelte';
  import type { Commit } from './model/commit';

  let data: Commit[];

  onMount(async () => {
    await loadData();
  });

  async function loadData() {
    const resp = await fetch('http://localhost:8080/api/commits', { method: 'GET' });
    data = resp.ok ? await resp.json() : [];
  }
</script>

<div class="main-container">
  <div class="header-container">
    <Header {loadData} />
  </div>
  <div class="content-container">
    <CommitTable {data} />
  </div>
</div>

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
