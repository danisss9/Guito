<script lang="ts">
  import { onMount } from 'svelte';
  import * as monaco from 'monaco-editor';
  import Dialog, { Title, Content, Actions } from '@smui/dialog';
  import Button, { Label } from '@smui/button';
  import type { Commit } from '../model/commit';

  export let open = false;
  export let commit: Commit | null = null;
  export let onClose: () => void = () => {};

  let container: HTMLDivElement;
  let editor: monaco.editor.IStandaloneDiffEditor | null = null;
  let viewMode: 'sideBySide' | 'inline' = 'sideBySide';
  let diffContent = { original: '', modified: '' };
  let loading = false;
  let error = '';
  let selectedFileIndex = 0;
  let diffFiles: Array<{ path: string; original: string; modified: string }> = [];

  onMount(() => {
    // Configure Monaco editor
    monaco.editor.defineTheme('custom-light', {
      base: 'vs',
      inherit: true,
      rules: [],
      colors: {
        'editor.background': '#ffffff',
        'editor.lineNumbersBackground': '#f5f5f5',
      },
    });

    return () => {
      if (editor) {
        editor.dispose();
      }
    };
  });

  $: if (open && commit) {
    // Fetch when dialog opens with a commit selected
    fetchAndRenderDiff();
  }

  async function fetchAndRenderDiff() {
    if (!commit) {
      error = 'No commit selected';
      return;
    }

    loading = true;
    error = '';
    try {
      console.log('Fetching diff for commit:', commit.hash);
      const resp = await fetch('http://localhost:8080/api/commit/diff', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ hash: commit.hash }),
      });

      console.log('Diff response status:', resp.status);

      if (!resp.ok) {
        const errorData = await resp.text();
        console.error('Error response:', errorData);
        throw new Error(`Failed to fetch diff: ${resp.status} ${errorData}`);
      }

      const data = await resp.json();
      console.log('Diff data received:', data);

      diffFiles = data.files || [];

      if (diffFiles.length === 0) {
        error = 'No changes in this commit';
        return;
      }

      selectedFileIndex = 0;
      // Need to wait for container to be available
      setTimeout(() => renderDiff(), 100);
    } catch (err: any) {
      error = err.message || 'Failed to load diff';
      console.error('Diff fetch error:', err);
    } finally {
      loading = false;
    }
  }

  function renderDiff() {
    if (!container) {
      console.warn('Container not available');
      return;
    }

    if (selectedFileIndex >= diffFiles.length) {
      console.warn('Invalid file index:', selectedFileIndex, 'of', diffFiles.length);
      return;
    }

    const file = diffFiles[selectedFileIndex];
    console.log('Rendering diff for file:', file.path);

    diffContent = {
      original: file.original || '',
      modified: file.modified || '',
    };

    // Create or recreate the diff editor
    if (editor) {
      editor.dispose();
    }

    editor = monaco.editor.createDiffEditor(container, {
      theme: 'custom-light',
      readOnly: true,
      wordWrap: 'on',
      automaticLayout: true,
      originalEditable: false,
      renderSideBySide: viewMode === 'sideBySide',
      renderOverviewRuler: true,
      fontSize: 12,
      minimap: { enabled: false },
    } as monaco.editor.IStandaloneDiffEditorConstructionOptions);

    // Detect language from file extension
    const language = getLanguageFromFilepath(file.path);
    console.log('Detected language:', language, 'for file:', file.path);

    editor.setModel({
      original: monaco.editor.createModel(diffContent.original, language),
      modified: monaco.editor.createModel(diffContent.modified, language),
    });
  }

  function getLanguageFromFilepath(filepath: string): string {
    const ext = filepath.split('.').pop()?.toLowerCase() || '';
    const langMap: Record<string, string> = {
      ts: 'typescript',
      js: 'javascript',
      tsx: 'typescript',
      jsx: 'javascript',
      py: 'python',
      java: 'java',
      cpp: 'cpp',
      c: 'c',
      cs: 'csharp',
      css: 'css',
      html: 'html',
      json: 'json',
      xml: 'xml',
      yaml: 'yaml',
      yml: 'yaml',
      sh: 'shell',
      bash: 'shell',
      sql: 'sql',
      md: 'markdown',
    };
    return langMap[ext] || 'text';
  }

  function toggleViewMode() {
    viewMode = viewMode === 'sideBySide' ? 'inline' : 'sideBySide';
    if (editor) {
      editor.updateOptions({ renderSideBySide: viewMode === 'sideBySide' });
    }
  }

  function selectFile(index: number) {
    selectedFileIndex = index;
    renderDiff();
  }

  function handleClose() {
    if (editor) {
      editor.dispose();
      editor = null;
    }
    open = false;
    onClose();
  }
</script>

<Dialog bind:open on:MDCDialog:closed={handleClose} class="diff-dialog">
  <div class="dialog-content">
    <div class="dialog-header">
      <Title>Commit Diff: {commit?.hash.substring(0, 7)}</Title>
      <Button on:click={handleClose} class="close-button">
        <Label>✕</Label>
      </Button>
    </div>

    {#if loading}
      <div class="loading">Loading diff...</div>
    {:else if error}
      <div class="error">{error}</div>
    {:else}
      <div class="diff-container">
        <div class="toolbar">
          <div class="info">
            <span class="message">{commit?.message}</span>
            <span class="author">by {commit?.author_name}</span>
            {#if diffFiles.length > 0}
              <span class="file-count"
                >{diffFiles.length} file{diffFiles.length !== 1 ? 's' : ''} changed</span
              >
            {/if}
          </div>
          <Button on:click={toggleViewMode} variant="outlined">
            <Label>{viewMode === 'sideBySide' ? 'Inline' : 'Side by Side'}</Label>
          </Button>
        </div>

        {#if diffFiles.length > 1}
          <div class="file-list">
            {#each diffFiles as file, index}
              <button
                class={`file-tab ${index === selectedFileIndex ? 'active' : ''}`}
                on:click={() => selectFile(index)}
              >
                {file.path}
              </button>
            {/each}
          </div>
        {/if}

        {#if diffFiles.length > 0}
          <div class="current-file">
            <span>{diffFiles[selectedFileIndex].path}</span>
          </div>
        {/if}

        <div bind:this={container} class="editor-container"></div>
      </div>
    {/if}
  </div>
</Dialog>

<style>
  :global(.diff-dialog) {
    --mdc-dialog-max-width: 100vw;
    --mdc-dialog-max-height: 100vh;
  }

  :global(.diff-dialog .mdc-dialog__surface) {
    width: 100vw;
    height: 100vh;
    max-width: 100vw;
    max-height: 100vh;
    display: flex;
    flex-direction: column;
  }

  :global(.diff-dialog .mdc-dialog__title) {
    padding: 0;
  }

  :global(.diff-dialog .mdc-dialog__content) {
    padding: 0;
    flex: 1;
    overflow: hidden;
  }

  .dialog-content {
    width: 100%;
    height: 100%;
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }

  .dialog-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 16px;
    border-bottom: 1px solid #e0e0e0;
    background: #f5f5f5;
    flex-shrink: 0;
  }

  .close-button {
    min-width: auto;
    padding: 8px;
  }

  .diff-container {
    width: 100%;
    height: 100%;
    display: flex;
    flex-direction: column;
    background: white;
    overflow: hidden;
  }

  .loading {
    display: flex;
    align-items: center;
    justify-content: center;
    height: 100%;
    font-size: 1rem;
    color: #666;
  }

  .error {
    display: flex;
    align-items: center;
    justify-content: center;
    height: 100%;
    font-size: 1rem;
    color: #d32f2f;
    background: #ffebee;
    padding: 16px;
  }

  .toolbar {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 16px;
    border-bottom: 1px solid #e0e0e0;
    background: #f5f5f5;
    gap: 16px;
    flex-shrink: 0;
  }

  .info {
    display: flex;
    flex-direction: column;
    gap: 4px;
    flex: 1;
  }

  .message {
    font-weight: 600;
    color: #333;
    font-size: 0.95rem;
  }

  .author {
    font-size: 0.8rem;
    color: #666;
  }

  .file-count {
    font-size: 0.75rem;
    color: #999;
    margin-top: 4px;
  }

  .file-list {
    display: flex;
    gap: 8px;
    padding: 8px 16px;
    border-bottom: 1px solid #e0e0e0;
    background: #fafafa;
    overflow-x: auto;
    flex-shrink: 0;
  }

  .file-tab {
    padding: 6px 12px;
    border: 1px solid #e0e0e0;
    background: white;
    border-radius: 4px;
    cursor: pointer;
    font-size: 0.85rem;
    white-space: nowrap;
    transition: all 0.2s;
  }

  .file-tab:hover {
    background: #f5f5f5;
    border-color: #ccc;
  }

  .file-tab.active {
    background: #1976d2;
    color: white;
    border-color: #1976d2;
  }

  .current-file {
    padding: 8px 16px;
    font-size: 0.85rem;
    color: #666;
    border-bottom: 1px solid #e0e0e0;
    background: #fafafa;
    flex-shrink: 0;
  }

  .editor-container {
    flex: 1;
    overflow: hidden;
    min-height: 0;
  }

  :global(.diff-container .mdc-button) {
    margin-left: auto;
  }
</style>
