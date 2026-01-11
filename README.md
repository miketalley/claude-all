# Claude-All

An autonomous agent system that uses Claude Code to incrementally build projects from a PRD.

## Installation

### Global Install from GitHub

```bash
npm install -g github:miketalley/claude-all
```

### Global Install from npm (if published)

```bash
npm install -g claude-all
```

### Verify Installation

```bash
claude-all --help
```

## Usage

Once installed globally, run from any project directory:

```bash
# Resume existing PRD or start new one interactively
claude-all

# Generate PRD from a markdown file
claude-all my-project.md

# With custom iteration limit
claude-all my-project.md --max-iterations 20
```

## How It Works

1. **PRD Input**: Provide a project description via file or interactive input
2. **JSON Generation**: Converts your description into structured `output/prd.json`
3. **Agent Loop**: Iterates through user stories, implementing one per iteration
4. **Completion**: Stops when all stories pass or max iterations reached

### Smart Resume

When run without arguments:
- Checks for existing `output/prd.json` with incomplete stories
- If found, shows progress and resumes working on remaining stories
- If all complete, suggests how to start a new project
- If no PRD exists, prompts for project description

## Requirements

- Node.js 18+
- Claude Code CLI installed and authenticated (`claude` command available)

## Options

| Option | Description | Default |
|--------|-------------|---------|
| `<file>` | Path to .md/.txt file with project description | - |
| `--max-iterations` | Maximum agent iterations | 10 |

## Project Structure

When installed globally, claude-all creates an `output/` directory in your current working directory:

```
your-project/
└── output/                    # Created by claude-all
    ├── prd.json               # Generated PRD with user stories
    ├── progress.txt           # Log of completed work
    └── archive/               # Previous runs (auto-archived on branch change)
```

## Resuming Work

If `output/prd.json` exists with incomplete stories, claude-all automatically resumes. To start fresh:
- Delete `output/prd.json` and run again, or
- Run with a new .md file to overwrite

## Example

```bash
# Navigate to your project
cd my-new-project

# Create a project description
cat > todo-app.md << 'EOF'
Build a todo app with:
- Add new tasks
- Mark tasks complete
- Delete tasks
- Filter by status
EOF

# Run claude-all
claude-all todo-app.md
```

The agent will:
1. Generate `output/prd.json` with ordered user stories
2. Create a git branch (`ralph/todo-app`)
3. Implement each story, committing as it goes
4. Update `output/progress.txt` with learnings
5. Complete when all stories pass

## Library Usage

Claude-All can also be used as a library in your Node.js projects:

```bash
npm install github:miketalley/claude-all
```

```javascript
const {
  createConfig,
  runClaude,
  generatePrdJson,
  runAgentLoop,
  hasIncompleteStories,
} = require('claude-all');

// Create config for a working directory
const config = createConfig({ workingDir: '/path/to/project' });

// Check PRD status
const status = hasIncompleteStories(config.PRD_FILE);
console.log(`${status.remaining} stories remaining`);

// Generate PRD from text
await generatePrdJson('Build a todo app', config);

// Run the agent loop
const success = await runAgentLoop(config, {
  maxIterations: 10,
  onIteration: (i, max) => console.log(`Iteration ${i}/${max}`),
});
```

See [CLAUDE.md](./CLAUDE.md) for full API documentation.

## Development

```bash
# Clone the repo
git clone https://github.com/miketalley/claude-all.git
cd claude-all

# Install dependencies
npm install

# Run tests
npm test

# Link for local development
npm link
```
