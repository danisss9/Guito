<script lang="ts">
  import Dialog, { Title, Content, Actions } from '@smui/dialog';
  import Button, { Label } from '@smui/button';
  import Textfield from '@smui/textfield';
  import HelperText from '@smui/textfield/helper-text';

  export let open = false;
  export let isAmend = false;
  export let onCommit: (message: string, description: string) => Promise<void>;

  let message = '';
  let description = '';
  let loading = false;
  let error = '';

  async function handleCommit() {
    if (!message.trim()) {
      error = 'Commit message is required';
      return;
    }
    loading = true;
    error = '';
    try {
      await onCommit(message, description);
      message = '';
      description = '';
      open = false;
    } catch (err: any) {
      error = err.message;
    } finally {
      loading = false;
    }
  }

  function handleClose() {
    open = false;
    message = '';
    description = '';
    error = '';
  }
</script>

<Dialog bind:open on:MDCDialog:closed={handleClose}>
  <Title>{isAmend ? 'Amend' : 'Commit'} Changes</Title>
  <Content>
    <div style="min-width: 400px; display: flex; flex-direction: column; gap: 16px;">
      <Textfield
        variant="outlined"
        bind:value={message}
        label="Commit message"
        disabled={loading}
        required
      />
      <Textfield
        variant="outlined"
        bind:value={description}
        label="Description (optional)"
        textarea
        style="min-height: 100px;"
        disabled={loading}
      />
      {#if error}
        <div style="color: #d32f2f; font-size: 0.875rem;">{error}</div>
      {/if}
    </div>
  </Content>
  <Actions>
    <Button on:click={handleClose} disabled={loading}>
      <Label>Cancel</Label>
    </Button>
    <Button on:click={handleCommit} disabled={loading} variant="raised">
      <Label>{loading ? 'Committing...' : isAmend ? 'Amend' : 'Commit'}</Label>
    </Button>
  </Actions>
</Dialog>

<style>
  :global(.mdc-dialog__content) {
    padding: 20px;
  }
</style>
