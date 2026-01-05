# Guito - Quick Reference Guide

## Getting Started

### Launch the App
```bash
npm run dev        # Development with hot reload
npm run build:start # Build and start production
npm start          # Start pre-built server
```

The app opens automatically in your browser at `http://localhost:8080`

## Features by Category

### 📝 Staging & Commits
**Header Icon:** Check Circle

1. **Stage/Unstage Files**
   - Click "Stage/Unstage Files" button
   - Select files to stage or unstage
   - Supports partial file staging via patch mode

2. **Create Commit**
   - Click "Commit" button
   - Enter commit message (required)
   - Add optional description
   - Click "Commit" to save

3. **Amend Last Commit**
   - Click "Amend" button
   - Modify the message/description
   - Changes are applied to the last commit

4. **Revert Commit**
   - Click "Revert" button
   - Enter commit hash to revert
   - Creates new commit that undoes changes

### 🌿 Branch Management
**Header Icon:** Fork

1. **View & Switch Branches**
   - Click "Branches" button
   - Current branch highlighted in blue
   - Click "Checkout" to switch branches
   - Click delete icon to remove branches
   - Click "New Branch" to create

2. **Create Branch**
   - Click "New Branch" in Branches dialog
   - Enter branch name
   - Branches from current commit

3. **Merge Branch**
   - Click "Merge" button
   - Enter branch name to merge
   - Current branch gets merged changes

4. **Rebase Branch**
   - Click "Rebase" button
   - Enter branch to rebase onto
   - Replays current commits on target branch

### 📦 Stash
**Header Icon:** Inventory Box

1. **Create Stash**
   - Click "Stash" button
   - Enter description for changes
   - Click "Save"
   - Working directory is cleaned

2. **Restore from Stash**
   - Click "Stash" button
   - Click "Apply" to keep stash or "Pop" to remove it
   - Changes are restored to working directory

3. **Preview Stash**
   - Click "Stash" button
   - Click eye icon to see what's in stash
   - Shows file diffs without applying

4. **Delete Stash**
   - Click "Stash" button
   - Click delete icon to permanently remove

### 🏷️ Tags
**Header Icon:** Label

1. **Create Tag**
   - Click "Tags" button
   - Enter tag name
   - Optionally check "Annotated tag" for message
   - Click "Create Tag"

2. **View Tags**
   - Click "Tags" button
   - All tags listed with delete option
   - Tags mark specific commits for releases

3. **Delete Tag**
   - Click "Tags" button
   - Click delete icon next to tag name

### 🔄 Remote Operations
**Header Icons:** Cloud icons (Fetch, Pull, Push)

1. **Fetch from Remote**
   - Click "Fetch" button
   - Updates remote tracking branches
   - Safe operation - no local changes

2. **Pull from Remote**
   - Click "Pull" button
   - Fetches and merges remote changes
   - Equivalent to fetch + merge

3. **Push to Remote**
   - Click "Push" button
   - Sends local commits to remote
   - Updates remote branch

## Header Layout

```
[Menu] Guito               Branch: main

[Staging]      [Commits]              [Branches]         [Stash/Tags]  [Remote]
 📋            📝 📝(Amend) ↩️        🌿  🔀  ↻          📦  🏷️      ☁️↓ ☁️↑ ☁️↔️
Stage          Commit Amend  Revert   Branches Merge Rebase Stash Tags Fetch Pull Push
```

## Keyboard Tips

- **Commit Dialog**: Enter to submit (with valid message)
- **Selection**: Click checkboxes to select files
- **Dialogs**: Escape to close (on most)

## Error Handling

All operations show error messages if something goes wrong:
- Missing required info (message, branch names)
- Git command failures
- Network issues with remote operations

## Common Workflows

### Create & Commit Work
1. Make changes to files
2. Click "Stage/Unstage Files"
3. Select files you want to commit
4. Click "Commit"
5. Enter message and click "Commit"

### Create a Feature Branch
1. Click "Branches"
2. Click "New Branch"
3. Enter branch name (e.g., "feature/new-ui")
4. Click "Create Branch"

### Save Work Temporarily
1. Click "Stash"
2. Enter description
3. Click "Save"
4. Switch to another branch or pull
5. Come back and click "Pop" to restore

### Release with Tag
1. Make sure commits are pushed
2. Click "Tags"
3. Enter tag name (e.g., "v1.0.0")
4. Check "Annotated tag" for release notes
5. Click "Create Tag"

### Merge Completed Feature
1. Click "Branches"
2. Checkout main/master branch
3. Go back to header
4. Click "Merge"
5. Enter feature branch name
6. Resolve any conflicts if needed

## Status Indicators

- **Branch Name (Blue, Bold)**: Currently checked out branch
- **Green Files**: Staged files ready to commit
- **(current)**: Shows which branch you're on
- **Preview**: Shows what changes are in a stash

## Tips & Tricks

- Always review what you're staging before committing
- Use stash to save incomplete work before switching branches
- Annotated tags with messages are better for releases
- Fetch regularly to stay updated with remote changes
- Use descriptive commit messages and branch names

## Troubleshooting

**"Checkout failed"** 
- Ensure working directory is clean (stage/stash changes)
- Branch might not exist

**"Merge failed"**
- Might have conflicts to resolve
- Ensure both branches have commits

**"Push failed"**
- Check network connection
- Ensure you have permissions on remote
- May need to pull first

**"No changes to stage"**
- Working directory is clean
- All changes are already staged

## Next Steps

- Explore stash for temporary work
- Use branches for different features
- Tag releases for easy reference
- Push/Pull regularly to stay in sync
