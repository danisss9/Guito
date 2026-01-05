<script lang="ts">
  import Dialog, { Title, Content, Actions } from '@smui/dialog';
  import Button, { Label } from '@smui/button';
  import List, { Item, Text } from '@smui/list';
  import Checkbox from '@smui/checkbox';
  import type { StatusSummary } from '../model/status';

  export let open = false;
  export let status: StatusSummary | null = null;
  export let onStage: (files: string[]) => Promise<void>;
  export let onUnstage: (files: string[]) => Promise<void>;

  let selectedFiles: Set<string> = new Set();
  let loading = false;
  let error = '';

  function toggleFile(file: string) {
    if (selectedFiles.has(file)) {
      selectedFiles.delete(file);
    } else {
      selectedFiles.add(file);
    }
    selectedFiles = selectedFiles; // trigger reactivity
  }

  function toggleAll(files: string[]) {
    if (selectedFiles.size === files.length) {
      selectedFiles.clear();
    } else {
      selectedFiles = new Set(files);
    }
    selectedFiles = selectedFiles;
  }

  async function handleStage() {
    if (selectedFiles.size === 0) return;
    loading = true;
    error = '';
    try {
      await onStage(Array.from(selectedFiles));
      selectedFiles.clear();
    } catch (err: any) {
      error = err.message;
    } finally {
      loading = false;
    }
  }

  async function handleUnstage() {
    if (selectedFiles.size === 0) return;
    loading = true;
    error = '';
    try {
      await onUnstage(Array.from(selectedFiles));
      selectedFiles.clear();
    } catch (err: any) {
      error = err.message;
    } finally {
      loading = false;
    }
  }

  function handleClose() {
    open = false;
    error = '';
    selectedFiles.clear();
  }
</script>

<Dialog bind:open on:MDCDialog:closed={handleClose}>
  <Title>Stage Changes</Title>
  <Content>
    <div style="min-width: 450px;">
      {#if status}
        {#if status.not_added.length > 0 || status.modified.length > 0 || status.deleted.length > 0}
          <div style="margin-bottom: 20px;">
            <div style="display: flex; align-items: center; margin-bottom: 10px;">
              <h3 style="flex: 1; margin: 0;">Unstaged Changes</h3>
              <Button
                on:click={() =>
                  toggleAll([
                    ...(status?.not_added || []),
                    ...(status?.modified || []),
                    ...(status?.deleted || []),
                  ])}
                disabled={loading}
              >
                <Label>Select All</Label>
              </Button>
              <Button
                on:click={handleStage}
                disabled={loading || selectedFiles.size === 0}
                variant="raised"
              >
                <Label>Stage Selected</Label>
              </Button>
            </div>
            <List style="max-height: 200px; overflow-y: auto;">
              {#each [...(status?.not_added || []), ...(status?.modified || []), ...(status?.deleted || [])] as file (file)}
                <Item>
                  <Checkbox
                    checked={selectedFiles.has(file)}
                    on:change={() => toggleFile(file)}
                    disabled={loading}
                  />
                  <Text style="margin-left: 12px;">{file}</Text>
                </Item>
              {/each}
            </List>
          </div>
        {/if}

        {#if status.staged.length > 0}
          <div style="border-top: 1px solid #e0e0e0; padding-top: 20px;">
            <div style="display: flex; align-items: center; margin-bottom: 10px;">
              <h3 style="flex: 1; margin: 0;">Staged Changes</h3>
              <Button on:click={() => toggleAll(status?.staged || [])} disabled={loading}>
                <Label>Select All</Label>
              </Button>
              <Button
                on:click={handleUnstage}
                disabled={loading || selectedFiles.size === 0}
                variant="raised"
              >
                <Label>Unstage Selected</Label>
              </Button>
            </div>
            <List style="max-height: 200px; overflow-y: auto;">
              {#each status?.staged || [] as file (file)}
                <Item>
                  <Checkbox
                    checked={selectedFiles.has(file)}
                    on:change={() => toggleFile(file)}
                    disabled={loading}
                  />
                  <Text style="margin-left: 12px; color: #4caf50;">{file}</Text>
                </Item>
              {/each}
            </List>
          </div>
        {/if}

        {#if !status.staged.length && !status.not_added.length && !status.modified.length && !status.deleted.length}
          <div style="color: #999; padding: 40px; text-align: center;">
            Working directory is clean
          </div>
        {/if}
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
