<script lang="ts">
  import Dialog, { Title, Content, Actions } from '@smui/dialog';
  import Button, { Label } from '@smui/button';
  import List, { Item, Text } from '@smui/list';
  import IconButton from '@smui/icon-button';
  import type { BranchSummary } from '../model/branch';

  export let open = false;
  export let branches: BranchSummary | null = null;
  export let currentBranch = '';
  export let onCheckout: (branch: string) => Promise<void>;
  export let onDelete: (branch: string) => Promise<void>;
  export let onCreate: () => void;

  let loading = false;
  let error = '';

  async function handleCheckout(branch: string) {
    if (branch === currentBranch) return;
    loading = true;
    error = '';
    try {
      await onCheckout(branch);
      open = false;
    } catch (err: any) {
      error = err.message;
    } finally {
      loading = false;
    }
  }

  async function handleDelete(branch: string) {
    if (confirm(`Delete branch "${branch}"?`)) {
      loading = true;
      error = '';
      try {
        await onDelete(branch);
      } catch (err: any) {
        error = err.message;
      } finally {
        loading = false;
      }
    }
  }

  function handleClose() {
    open = false;
    error = '';
  }
</script>

<Dialog bind:open on:MDCDialog:closed={handleClose}>
  <Title>Manage Branches</Title>
  <Content>
    <div style="min-width: 400px;">
      {#if branches}
        <List style="max-height: 400px; overflow-y: auto;">
          {#each branches.all as branch (branch.name)}
            <Item>
              <Text>
                <span
                  style={branch.name === currentBranch ? 'font-weight: bold; color: #1976d2;' : ''}
                >
                  {branch.name}
                </span>
                {#if branch.name === currentBranch}
                  <span style="margin-left: 8px; color: #4caf50; font-size: 0.875rem;"
                    >(current)</span
                  >
                {/if}
              </Text>
              <div style="display: flex; gap: 4px; margin-left: auto;">
                {#if branch.name !== currentBranch}
                  <Button on:click={() => handleCheckout(branch.name)} disabled={loading}>
                    <Label style="font-size: 0.75rem;">Checkout</Label>
                  </Button>
                {/if}
                {#if branch.name !== currentBranch}
                  <IconButton
                    class="material-icons"
                    on:click={() => handleDelete(branch.name)}
                    disabled={loading}
                    title="Delete branch"
                  >
                    delete
                  </IconButton>
                {/if}
              </div>
            </Item>
          {/each}
        </List>
      {/if}
      {#if error}
        <div style="color: #d32f2f; font-size: 0.875rem; margin-top: 12px;">{error}</div>
      {/if}
    </div>
  </Content>
  <Actions>
    <Button on:click={() => onCreate()}>
      <Label>New Branch</Label>
    </Button>
    <Button on:click={handleClose}>
      <Label>Close</Label>
    </Button>
  </Actions>
</Dialog>
