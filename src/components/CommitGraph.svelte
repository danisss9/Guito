<script lang="ts">
  import type { Commit } from '../model/commit';

  export let index: number;
  export let totalCommits: number;

  const DOT_RADIUS = 4;
  const DOT_COLOR = '#1976d2';

  const isLast = index === totalCommits - 1;
</script>

<div class="graph-cell">
  <svg width="24" height="52" viewBox="0 0 24 52" class="graph-svg">
    <!-- Draw line from top to dot -->
    {#if index > 0}
      <line x1="12" y1="0" x2="12" y2="10" stroke={DOT_COLOR} stroke-width="2" />
    {/if}

    <!-- Draw commit dot -->
    <circle cx="12" cy="12" r={DOT_RADIUS} fill={DOT_COLOR} stroke="white" stroke-width="2" />

    <!-- Draw line from dot to bottom -->
    {#if !isLast}
      <line x1="12" y1="14" x2="12" y2="52" stroke={DOT_COLOR} stroke-width="2" />
    {/if}
  </svg>
</div>

<style>
  .graph-cell {
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 0 8px;
    width: 40px;
    height: 100%;
  }

  .graph-svg {
    overflow: visible;
    display: block;
  }
</style>
