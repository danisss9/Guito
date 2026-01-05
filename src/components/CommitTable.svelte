<script lang="ts">
  import DataTable, { Head, Body, Row, Cell } from '@smui/data-table';
  import CircularProgress from '@smui/circular-progress';
  import CommitGraph from './CommitGraph.svelte';
  import type { Commit } from '../model/commit';

  export let data: Commit[];
</script>

{#if data == null}
  <div class="loading">
    <CircularProgress style="height: 40px; width: 40px;" indeterminate />
  </div>
{:else}
  <DataTable stickyHeader style="width: 100%;">
    <Head>
      <Row>
        <Cell>Graph</Cell>
        <Cell style="width: 100%;">Description</Cell>
        <Cell>Date</Cell>
        <Cell>Author</Cell>
        <Cell>Hash</Cell>
      </Row>
    </Head>
    <Body>
      {#each data as item (item.hash)}
        <Row>
          <Cell></Cell>
          <Cell>{item.message}</Cell>
          <Cell>{item.date}</Cell>
          <Cell>{item.author_name}</Cell>
          <Cell>{item.hash}</Cell>
        </Row>
      {/each}
    </Body>
  </DataTable>
{/if}

<style>
  .loading {
    display: flex;
    align-items: center;
    justify-content: center;
  }
</style>
