#!/usr/bin/env node

/**
 * Claude-All - Long-running AI agent loop with PRD generation
 *
 * Usage:
 *   node claude-all.js <prd-file.md>     - Read PRD from file
 *   node claude-all.js                   - Prompt for PRD text interactively
 *   node claude-all.js --max-iterations N  - Set max iterations (default: 10)
 */

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const readline = require('readline');

// Configuration
const SCRIPT_DIR = __dirname;
const PRD_FILE = path.join(SCRIPT_DIR, 'prd.json');
const PROGRESS_FILE = path.join(SCRIPT_DIR, 'progress.txt');
const ARCHIVE_DIR = path.join(SCRIPT_DIR, 'archive');
const LAST_BRANCH_FILE = path.join(SCRIPT_DIR, '.last-branch');
const PROMPT_FILE = path.join(SCRIPT_DIR, 'prompt.md');
const COMPLETION_SIGNAL = '<promise>COMPLETE</promise>';

// ANSI color codes
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  red: '\x1b[31m',
};

function log(message, color = '') {
  console.log(`${color}${message}${colors.reset}`);
}

function logHeader(message) {
  console.log('');
  console.log(`${colors.cyan}${'═'.repeat(55)}${colors.reset}`);
  console.log(`${colors.cyan}  ${message}${colors.reset}`);
  console.log(`${colors.cyan}${'═'.repeat(55)}${colors.reset}`);
}

// Parse command line arguments
function parseArgs() {
  const args = process.argv.slice(2);
  let inputFile = null;
  let maxIterations = 10;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--max-iterations' && args[i + 1]) {
      maxIterations = parseInt(args[i + 1], 10);
      i++;
    } else if (!args[i].startsWith('--')) {
      inputFile = args[i];
    }
  }

  return { inputFile, maxIterations };
}

// Read multiline input from user
async function promptForInput() {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    log('\nEnter your project description (press Ctrl+D or type "END" on a new line when done):', colors.yellow);
    log('', colors.dim);

    let input = '';

    rl.on('line', (line) => {
      if (line.trim().toUpperCase() === 'END') {
        rl.close();
      } else {
        input += line + '\n';
      }
    });

    rl.on('close', () => {
      resolve(input.trim());
    });
  });
}

// Read PRD content from file
function readPrdFile(filePath) {
  const resolvedPath = path.resolve(filePath);
  if (!fs.existsSync(resolvedPath)) {
    log(`Error: File not found: ${resolvedPath}`, colors.red);
    process.exit(1);
  }
  return fs.readFileSync(resolvedPath, 'utf-8');
}

// Run claude command and stream output
function runClaude(prompt, streamOutput = true) {
  return new Promise((resolve, reject) => {
    const claude = spawn('claude', ['--dangerously-skip-permissions'], {
      stdio: ['pipe', 'pipe', 'pipe'],
      shell: true,
    });

    let output = '';

    claude.stdout.on('data', (data) => {
      const text = data.toString();
      output += text;
      if (streamOutput) {
        process.stdout.write(text);
      }
    });

    claude.stderr.on('data', (data) => {
      const text = data.toString();
      output += text;
      if (streamOutput) {
        process.stderr.write(text);
      }
    });

    claude.stdin.write(prompt);
    claude.stdin.end();

    claude.on('close', (code) => {
      resolve({ output, code });
    });

    claude.on('error', (err) => {
      reject(err);
    });
  });
}

// Archive previous run if branch changed
function archivePreviousRun() {
  if (!fs.existsSync(PRD_FILE) || !fs.existsSync(LAST_BRANCH_FILE)) {
    return;
  }

  try {
    const prd = JSON.parse(fs.readFileSync(PRD_FILE, 'utf-8'));
    const currentBranch = prd.branchName || '';
    const lastBranch = fs.readFileSync(LAST_BRANCH_FILE, 'utf-8').trim();

    if (currentBranch && lastBranch && currentBranch !== lastBranch) {
      const date = new Date().toISOString().split('T')[0];
      const folderName = lastBranch.replace(/^ralph\//, '');
      const archiveFolder = path.join(ARCHIVE_DIR, `${date}-${folderName}`);

      log(`Archiving previous run: ${lastBranch}`, colors.dim);
      fs.mkdirSync(archiveFolder, { recursive: true });

      if (fs.existsSync(PRD_FILE)) {
        fs.copyFileSync(PRD_FILE, path.join(archiveFolder, 'prd.json'));
      }
      if (fs.existsSync(PROGRESS_FILE)) {
        fs.copyFileSync(PROGRESS_FILE, path.join(archiveFolder, 'progress.txt'));
      }

      log(`   Archived to: ${archiveFolder}`, colors.dim);

      // Reset progress file for new run
      fs.writeFileSync(PROGRESS_FILE, `# Ralph Progress Log\nStarted: ${new Date().toISOString()}\n---\n`);
    }
  } catch (err) {
    // Ignore errors in archiving
  }
}

// Track current branch
function trackCurrentBranch() {
  if (!fs.existsSync(PRD_FILE)) {
    return;
  }

  try {
    const prd = JSON.parse(fs.readFileSync(PRD_FILE, 'utf-8'));
    if (prd.branchName) {
      fs.writeFileSync(LAST_BRANCH_FILE, prd.branchName);
    }
  } catch (err) {
    // Ignore errors
  }
}

// Initialize progress file
function initProgressFile() {
  if (!fs.existsSync(PROGRESS_FILE)) {
    fs.writeFileSync(PROGRESS_FILE, `# Ralph Progress Log\nStarted: ${new Date().toISOString()}\n---\n`);
  }
}

// Generate prd.json from PRD text using the ralph skill
async function generatePrdJson(prdText) {
  log('\nGenerating prd.json from your project description...', colors.yellow);

  const prompt = `/ralph

${prdText}`;

  await runClaude(prompt, true);

  // Check if prd.json was created
  if (fs.existsSync(PRD_FILE)) {
    log('\nprd.json generated successfully!', colors.green);
    return true;
  }

  log('\nWarning: prd.json may not have been created. Please check the output above.', colors.yellow);
  return false;
}

// Main agent loop
async function runAgentLoop(maxIterations) {
  log(`\nStarting Ralph - Max iterations: ${maxIterations}`, colors.bright);

  const promptContent = fs.readFileSync(PROMPT_FILE, 'utf-8');

  for (let i = 1; i <= maxIterations; i++) {
    logHeader(`Ralph Iteration ${i} of ${maxIterations}`);

    const { output } = await runClaude(promptContent, true);

    // Check for completion signal
    if (output.includes(COMPLETION_SIGNAL)) {
      console.log('');
      log('Ralph completed all tasks!', colors.green + colors.bright);
      log(`Completed at iteration ${i} of ${maxIterations}`, colors.green);
      return true;
    }

    log(`\nIteration ${i} complete. Continuing...`, colors.dim);

    // Brief pause between iterations
    await new Promise(resolve => setTimeout(resolve, 2000));
  }

  console.log('');
  log(`Ralph reached max iterations (${maxIterations}) without completing all tasks.`, colors.yellow);
  log(`Check ${PROGRESS_FILE} for status.`, colors.yellow);
  return false;
}

// Check if prd.json exists and is valid
function hasPrdJson() {
  if (!fs.existsSync(PRD_FILE)) {
    return false;
  }
  try {
    JSON.parse(fs.readFileSync(PRD_FILE, 'utf-8'));
    return true;
  } catch {
    return false;
  }
}

// Main function
async function main() {
  const { inputFile, maxIterations } = parseArgs();

  log('Claude-All Agent System', colors.cyan + colors.bright);
  log('═'.repeat(55), colors.cyan);

  // Check if we need to generate prd.json or if we're resuming
  if (!hasPrdJson()) {
    let prdText;

    if (inputFile) {
      log(`\nReading PRD from: ${inputFile}`, colors.blue);
      prdText = readPrdFile(inputFile);
    } else {
      prdText = await promptForInput();

      if (!prdText) {
        log('No input provided. Exiting.', colors.red);
        process.exit(1);
      }
    }

    // Generate prd.json from the input
    const success = await generatePrdJson(prdText);
    if (!success) {
      log('Failed to generate prd.json. Please try again.', colors.red);
      process.exit(1);
    }
  } else {
    log('\nExisting prd.json found. Resuming agent loop...', colors.blue);
  }

  // Archive previous run if needed
  archivePreviousRun();

  // Track current branch
  trackCurrentBranch();

  // Initialize progress file
  initProgressFile();

  // Run the agent loop
  const completed = await runAgentLoop(maxIterations);

  // Notify user
  console.log('');
  if (completed) {
    log('All tasks completed successfully!', colors.green + colors.bright);
  } else {
    log('Agent loop finished. Review progress.txt for details.', colors.yellow);
  }

  process.exit(completed ? 0 : 1);
}

// Run
main().catch((err) => {
  log(`Error: ${err.message}`, colors.red);
  process.exit(1);
});
