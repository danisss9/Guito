<script lang="ts">
  import Dialog, { Title, Content, Actions } from '@smui/dialog';
  import Button, { Label } from '@smui/button';
  import Textfield from '@smui/textfield';
  import List, { Item, Text } from '@smui/list';
  import IconButton from '@smui/icon-button';
  import type { StashListSummary } from '../model/stash';

  export let open = false;
  export let stashes: StashListSummary | null = null;
  export let onSave: (message: string) => Promise<void>;
  export let onApply: (index: number) => Promise<void>;
  export let onPop: (index: number) => Promise<void>;
  export let onDrop: (index: number) => Promise<void>;
  export let onShow: (index: number) => Promise<string>;

  let newMessage = '';
  let loading = false;
  let error = '';
  let selectedStashPreview = '';

  async function handleSave() {
    if (!newMessage.trim()) {
      error = 'Stash message is required';
      return;
    }
    loading = true;
    error = '';
    try {
      await onSave(newMessage);
      newMessage = '';
    } catch (err: any) {
      error = err.message;
    } finally {
      loading = false;
    }
  }

  async function handleApply(index: number) {
    loading = true;
    error = '';
    try {
      await onApply(index);
    } catch (err: any) {
      error = err.message;
    } finally {
      loading = false;
    }
  }

  async function handlePop(index: number) {
    loading = true;
    error = '';
    try {
      await onPop(index);
    } catch (err: any) {
      error = err.message;
    } finally {
      loading = false;
    }
  }

  async function handleDrop(index: number) {
    if (confirm('Delete this stash?')) {
      loading = true;
      error = '';
      try {
        await onDrop(index);
      } catch (err: any) {
        error = err.message;
      } finally {
        loading = false;
      }
    }
  }

  async function handleShowPreview(index: number) {
    loading = true;
    error = '';
    try {
      selectedStashPreview = await onShow(index);
    } catch (err: any) {
      error = err.message;
    } finally {
      loading = false;
    }
  }

  function handleClose() {
    open = false;
    error = '';
    selectedStashPreview = '';
  }
</script>

<Dialog bind:open on:MDCDialog:closed={handleClose}>
  <Title>Stash Manager</Title>
  <Content>
    <div style="min-width: 500px;">
      <div style="margin-bottom: 20px;">
        <h3 style="margin: 0 0 10px 0;">Create New Stash</h3>
        <div style="display: flex; gap: 8px;">
          <Textfield
            variant="outlined"
            bind:value={newMessage}
            label="Message"
            disabled={loading}
            style="flex: 1;"
          />
          <Button on:click={handleSave} disabled={loading || !newMessage.trim()} variant="raised">
            <Label>Save</Label>
          </Button>
        </div>
      </div>

      <div style="border-top: 1px solid #e0e0e0; padding-top: 20px;">
        <h3 style="margin: 0 0 10px 0;">Stashes ({stashes?.total || 0})</h3>
        {#if stashes && stashes.all.length > 0}
          <List style="max-height: 300px; overflow-y: auto;">
            {#each stashes.all as stash (stash.index)}
              <Item>
                <Text>
                  <div>
                    <div style="font-weight: 500;">{stash.message}</div>
                    <div style="font-size: 0.75rem; color: #999;">{stash.hash.substring(0, 7)}</div>
                  </div>
                </Text>
                <div style="display: flex; gap: 4px; margin-left: auto;">
                  <IconButton
                    class="material-icons"
                    on:click={() => handleShowPreview(stash.index)}
                    disabled={loading}
                    title="Preview"
                  >
                    visibility
                  </IconButton>
                  <IconButton
                    class="material-icons"
                    on:click={() => handleApply(stash.index)}
                    disabled={loading}
                    title="Apply"
                  >
                    check_circle
                  </IconButton>
                  <IconButton
                    class="material-icons"
                    on:click={() => handlePop(stash.index)}
                    disabled={loading}
                    title="Pop"
                  >
                    done_all
                  </IconButton>
                  <IconButton
                    class="material-icons"
                    on:click={() => handleDrop(stash.index)}
                    disabled={loading}
                    title="Delete"
                  >
                    delete
                  </IconButton>
                </div>
              </Item>
            {/each}
          </List>
        {:else}
          <div style="color: #999; padding: 20px; text-align: center;">No stashes</div>
        {/if}
      </div>

      {#if selectedStashPreview}
        <div style="margin-top: 20px; border-top: 1px solid #e0e0e0; padding-top: 20px;">
          <h4 style="margin: 0 0 10px 0;">Preview</h4>
          <pre
            style="background: #f5f5f5; padding: 10px; border-radius: 4px; max-height: 200px; overflow-y: auto; font-size: 0.75rem;">{selectedStashPreview}</pre>
        </div>
      {/if}

      {#if error}
        <div style="color: #d32f2f; font-size: 0.875rem; margin-top: 12px;">{error}</div>
      {/if}
    </div>
  </Content>
  <Actions>
    <Button on:click={handleClose}>
      <Label>Close</Label>
    </Button>
  </Actions>
</Dialog>
