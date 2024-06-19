<script lang="ts">
  import { onMount } from 'svelte';

  let data: string[] = [];

  onMount(async () => {
    const resp = await fetch('http://localhost:8080/api/commits', { method: 'GET' });
    data = await resp.json();
    console.log({ data });
  });
</script>

{#each data as commit}
  <p>{commit}</p>
{/each}
