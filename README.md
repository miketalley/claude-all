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

## Project Structure

```
claude-all/
├── claude-all.js              # Main script
├── lib/
│   ├── config.js              # Configuration module
│   ├── prd-utils.js           # PRD utility functions
│   └── prompt.md              # Instructions sent to Claude each iteration
├── .claude/skills/
│   ├── ralph/SKILL.md         # Skill for converting PRD to prd.json
│   └── prd/SKILL.md           # Skill for generating PRD documents
└── output/                    # Created at runtime in your project directory
    ├── prd.json               # Generated PRD with user stories
    ├── progress.txt           # Log of completed work
    └── archive/               # Previous runs (auto-archived on branch change)
```

## Requirements

- Node.js 18+
- Claude Code CLI installed and authenticated (`claude` command available)

## Options

| Option | Description | Default |
|--------|-------------|---------|
| `<file>` | Path to .md/.txt file with project description | - |
| `--max-iterations` | Maximum agent iterations | 10 |

## Resuming

If `output/prd.json` exists, the script resumes from where it left off. To start fresh, delete the `output/` directory or just `output/prd.json` and `output/progress.txt`.

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
