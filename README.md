# Claude-All

An autonomous agent system that uses Claude Code to incrementally build projects from a PRD.

## Quick Start

```bash
# From a project description file
node claude-all.js my-project.md

# Interactive mode (enter description manually)
node claude-all.js

# With custom iteration limit
node claude-all.js my-project.md --max-iterations 20
```

## How It Works

1. **PRD Input**: Provide a project description via file or interactive input
2. **JSON Generation**: Uses the `/ralph` skill to convert your description into `prd.json`
3. **Agent Loop**: Iterates through user stories, implementing one per iteration
4. **Completion**: Stops when all stories pass or max iterations reached

## Files

| File | Purpose |
|------|---------|
| `claude-all.js` | Main script |
| `prd.json` | Generated PRD with user stories (created automatically) |
| `progress.txt` | Log of completed work |
| `lib/prompt.md` | Instructions sent to Claude each iteration |
| `archive/` | Previous runs (auto-archived on branch change) |

## Requirements

- Node.js 18+
- Claude Code CLI installed and authenticated (`claude` command available)

## Options

| Option | Description | Default |
|--------|-------------|---------|
| `<file>` | Path to .md/.txt file with project description | - |
| `--max-iterations` | Maximum agent iterations | 10 |

## Resuming

If `prd.json` exists, the script resumes from where it left off. To start fresh, delete `prd.json` and `progress.txt`.

## Skills

- **`/ralph`**: Converts PRD text to `prd.json` format
- **`/prd`**: Generates a full PRD document from a feature description

## Example

```bash
# Create a file with your project description
echo "Build a todo app with add, delete, and complete functionality" > todo-app.md

# Run claude-all
node claude-all.js todo-app.md
```

The agent will:
1. Generate `prd.json` with ordered user stories
2. Create a git branch (`ralph/todo-app`)
3. Implement each story, committing as it goes
4. Update `progress.txt` with learnings
5. Complete when all stories pass
