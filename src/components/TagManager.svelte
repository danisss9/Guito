<script lang="ts">
  import Dialog, { Title, Content, Actions } from '@smui/dialog';
  import Button, { Label } from '@smui/button';
  import Textfield from '@smui/textfield';
  import Checkbox from '@smui/checkbox';
  import List, { Item, Text } from '@smui/list';
  import IconButton from '@smui/icon-button';

  export let open = false;
  export let tags: string[] = [];
  export let onCreateTag: (name: string, message: string) => Promise<void>;
  export let onDeleteTag: (name: string) => Promise<void>;

  let newTagName = '';
  let newTagMessage = '';
  let isAnnotated = false;
  let loading = false;
  let error = '';

  async function handleCreateTag() {
    if (!newTagName.trim()) {
      error = 'Tag name is required';
      return;
    }
    loading = true;
    error = '';
    try {
      await onCreateTag(newTagName, isAnnotated ? newTagMessage : '');
      newTagName = '';
      newTagMessage = '';
      isAnnotated = false;
    } catch (err: any) {
      error = err.message;
    } finally {
      loading = false;
    }
  }

  async function handleDeleteTag(name: string) {
    if (confirm(`Delete tag "${name}"?`)) {
      loading = true;
      error = '';
      try {
        await onDeleteTag(name);
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
    newTagName = '';
    newTagMessage = '';
  }
</script>

<Dialog bind:open on:MDCDialog:closed={handleClose}>
  <Title>Tag Manager</Title>
  <Content>
    <div style="min-width: 400px;">
      <div style="margin-bottom: 20px;">
        <h3 style="margin: 0 0 10px 0;">Create New Tag</h3>
        <Textfield
          variant="outlined"
          bind:value={newTagName}
          label="Tag name"
          disabled={loading}
          style="width: 100%; margin-bottom: 12px;"
        />
        <div style="display: flex; align-items: center; margin-bottom: 12px;">
          <Checkbox bind:checked={isAnnotated} disabled={loading} />
          <span style="margin-left: 8px; cursor: pointer; user-select: none;"
            >Annotated tag (with message)</span
          >
        </div>
        {#if isAnnotated}
          <Textfield
            variant="outlined"
            bind:value={newTagMessage}
            label="Tag message"
            textarea
            disabled={loading}
            style="width: 100%; min-height: 80px; margin-bottom: 12px;"
          />
        {/if}
        <Button
          on:click={handleCreateTag}
          disabled={loading || !newTagName.trim()}
          variant="raised"
        >
          <Label>Create Tag</Label>
        </Button>
      </div>

      <div style="border-top: 1px solid #e0e0e0; padding-top: 20px;">
        <h3 style="margin: 0 0 10px 0;">Tags ({tags.length})</h3>
        {#if tags.length > 0}
          <List style="max-height: 300px; overflow-y: auto;">
            {#each tags as tag (tag)}
              <Item>
                <Text>{tag}</Text>
                <div style="margin-left: auto;">
                  <IconButton
                    class="material-icons"
                    on:click={() => handleDeleteTag(tag)}
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
          <div style="color: #999; padding: 20px; text-align: center;">No tags</div>
        {/if}
      </div>

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
