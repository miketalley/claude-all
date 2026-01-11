# Claude-All Project Context

This file provides context for Claude Code when working on this repository.

## Project Overview

Claude-All is an autonomous agent system that uses Claude Code to incrementally build projects from a PRD (Product Requirements Document). It converts PRDs into structured JSON with user stories, then iteratively works through each story using Claude instances.

## How It Works

1. **Input**: User provides a project description (via .md file or interactive input)
2. **PRD Generation**: Converts description to `output/prd.json` with structured user stories
3. **Agent Loop**: Spawns Claude instances to work on each story sequentially
4. **Progress Tracking**: Logs work to `output/progress.txt`
5. **Completion**: Stops when all stories have `passes: true` or max iterations reached

## Key Behavior (No Arguments Mode)

When run without specifying a .md file:
1. Checks for existing `output/prd.json` with incomplete stories (`passes: false`)
2. If found: Shows progress status and resumes working on remaining stories
3. If all complete: Informs user and exits (suggests starting new project)
4. If no PRD exists: Prompts user for project description to generate new PRD

## Project Structure

```
claude-all/
├── claude-all.js              # Main script (entry point)
├── lib/
│   ├── config.js              # Configuration module (paths, constants)
│   ├── prd-utils.js           # PRD utility functions (validation, file ops)
│   └── prompt.md              # Instructions sent to Claude each iteration
├── .claude/skills/
│   ├── ralph/SKILL.md         # Converts PRD text to prd.json format
│   └── prd/SKILL.md           # Generates full PRD documents
├── __tests__/
│   ├── fixtures/              # Test data files
│   ├── config.test.js
│   ├── integration.test.js
│   └── prd-utils.test.js
└── output/                    # Created at runtime (gitignored)
    ├── prd.json               # Generated PRD with user stories
    ├── progress.txt           # Log of completed work
    └── archive/               # Previous runs (auto-archived)
```

## Key Functions in claude-all.js

### Core Functions
- `main()` - Entry point, orchestrates the workflow
- `runAgentLoop(maxIterations)` - Main loop that spawns Claude instances
- `runClaude(prompt, streamOutput, spinner)` - Spawns Claude subprocess
- `generatePrdJson(prdText)` - Converts PRD text to prd.json

### Status Functions
- `hasPrdJson()` - Checks if valid prd.json exists
- `hasIncompleteStories()` - Returns detailed status of PRD progress:
  - `exists`: boolean - PRD file exists
  - `incomplete`: boolean - Has stories with passes: false
  - `total`: number - Total story count
  - `remaining`: number - Incomplete story count
  - `completed`: number - Completed story count
  - `projectName`: string - Project name from PRD

### File Management
- `ensureOutputDir()` - Creates output/ directory
- `initProgressFile()` - Initializes progress.txt
- `archivePreviousRun()` - Archives old PRD when branch changes
- `trackCurrentBranch()` - Tracks current branch for archiving

### UI Functions
- `Spinner` class - Braille loading spinner with status messages
- `logHeader(message)` - Prints section headers
- `log(message, color)` - Colored console output

## Configuration Constants

Located at top of claude-all.js:
- `SCRIPT_DIR` - Where claude-all.js lives
- `WORKING_DIR` - Where user runs command (project directory)
- `OUTPUT_DIR` - `{WORKING_DIR}/output`
- `PRD_FILE` - `{OUTPUT_DIR}/prd.json`
- `PROGRESS_FILE` - `{OUTPUT_DIR}/progress.txt`
- `PROMPT_FILE` - `{SCRIPT_DIR}/lib/prompt.md`
- `COMPLETION_SIGNAL` - `<promise>COMPLETE</promise>`

## prd.json Format

```json
{
  "project": "Project Name",
  "branchName": "ralph/feature-name",
  "description": "Brief description",
  "userStories": [
    {
      "id": "US-001",
      "title": "Story title",
      "description": "As a user, I want...",
      "acceptanceCriteria": ["Criterion 1", "Typecheck passes"],
      "priority": 1,
      "passes": false,
      "notes": ""
    }
  ]
}
```

## Important Implementation Details

### Spinner Behavior
- Spinners show until Claude starts producing output
- Passed to `runClaude()` which stops them on first stdout/stderr
- Uses braille characters: `⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏`

### Skill Embedding
- The `/ralph` skill instructions are embedded directly in prompts
- This avoids using a project's own `/ralph` skill definition
- Read from `{SCRIPT_DIR}/.claude/skills/ralph/SKILL.md`

### File Check Retry
- After PRD generation, file check has 3 retries with 500ms delays
- Handles filesystem timing issues

## Testing

Run tests: `npm test`
- 48 tests covering config, PRD utilities, and integration scenarios
- Tests use temp directories to avoid affecting real files

## Usage Examples

```bash
# Resume existing PRD or start new one interactively
node claude-all.js

# Generate from markdown file
node claude-all.js my-project.md

# With custom iteration limit
node claude-all.js --max-iterations 20
node claude-all.js my-project.md --max-iterations 15
```
