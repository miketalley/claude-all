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
const WORKING_DIR = process.cwd(); // Where the user runs the command from (the project being worked on)
const OUTPUT_DIR = path.join(WORKING_DIR, 'output');
const PRD_FILE = path.join(OUTPUT_DIR, 'prd.json');
const PROGRESS_FILE = path.join(OUTPUT_DIR, 'progress.txt');
const ARCHIVE_DIR = path.join(OUTPUT_DIR, 'archive');
const LAST_BRANCH_FILE = path.join(OUTPUT_DIR, '.last-branch');
const PROMPT_FILE = path.join(SCRIPT_DIR, 'lib', 'prompt.md');
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
  hideCursor: '\x1b[?25l',
  showCursor: '\x1b[?25h',
  clearLine: '\x1b[2K\r',
};

function log(message, color = '') {
  console.log(`${color}${message}${colors.reset}`);
}

// Loading spinner with changing messages
class Spinner {
  constructor(messages, color = colors.yellow) {
    this.frames = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
    this.messages = Array.isArray(messages) ? messages : [messages];
    this.color = color;
    this.frameIndex = 0;
    this.messageIndex = 0;
    this.interval = null;
    this.messageInterval = null;
  }

  start() {
    process.stdout.write(colors.hideCursor);
    this.render();

    // Rotate spinner frames every 80ms
    this.interval = setInterval(() => {
      this.frameIndex = (this.frameIndex + 1) % this.frames.length;
      this.render();
    }, 80);

    // Rotate messages every 3 seconds if multiple messages
    if (this.messages.length > 1) {
      this.messageInterval = setInterval(() => {
        this.messageIndex = (this.messageIndex + 1) % this.messages.length;
      }, 3000);
    }

    return this;
  }

  render() {
    const frame = this.frames[this.frameIndex];
    const message = this.messages[this.messageIndex];
    process.stdout.write(`${colors.clearLine}${this.color}${frame} ${message}${colors.reset}`);
  }

  stop(finalMessage = '', finalColor = colors.green) {
    if (this.interval) clearInterval(this.interval);
    if (this.messageInterval) clearInterval(this.messageInterval);
    process.stdout.write(colors.clearLine);
    process.stdout.write(colors.showCursor);
    if (finalMessage) {
      console.log(`${finalColor}✓ ${finalMessage}${colors.reset}`);
    }
  }

  // Update the current message dynamically
  update(message) {
    this.messages = [message];
    this.messageIndex = 0;
  }
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
// If spinner is provided, it will be stopped when first output arrives
function runClaude(prompt, streamOutput = true, spinner = null) {
  return new Promise((resolve, reject) => {
    const claude = spawn('claude', ['--dangerously-skip-permissions'], {
      stdio: ['pipe', 'pipe', 'pipe'],
      shell: true,
      cwd: WORKING_DIR, // Ensure Claude runs in the project directory
    });

    let output = '';
    let spinnerStopped = false;

    const stopSpinnerOnce = () => {
      if (spinner && !spinnerStopped) {
        spinnerStopped = true;
        spinner.stop();
        console.log('');
      }
    };

    claude.stdout.on('data', (data) => {
      stopSpinnerOnce();
      const text = data.toString();
      output += text;
      if (streamOutput) {
        process.stdout.write(text);
      }
    });

    claude.stderr.on('data', (data) => {
      stopSpinnerOnce();
      const text = data.toString();
      output += text;
      if (streamOutput) {
        process.stderr.write(text);
      }
    });

    claude.stdin.write(prompt);
    claude.stdin.end();

    claude.on('close', (code) => {
      stopSpinnerOnce(); // Ensure spinner is stopped even if no output
      resolve({ output, code });
    });

    claude.on('error', (err) => {
      stopSpinnerOnce();
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

// Read the ralph skill instructions from the script directory
function getRalphSkillInstructions() {
  const skillPath = path.join(SCRIPT_DIR, '.claude', 'skills', 'ralph', 'SKILL.md');
  if (fs.existsSync(skillPath)) {
    return fs.readFileSync(skillPath, 'utf-8');
  }
  // Fallback minimal instructions if skill file not found
  return `Convert the PRD to prd.json format. Save to output/prd.json in the current directory.`;
}

// Generate prd.json from PRD text using embedded skill instructions
async function generatePrdJson(prdText) {
  console.log('');
  const spinner = new Spinner('Converting PRD to prd.json format...', colors.yellow).start();

  // Embed skill instructions directly to avoid using project's /ralph skill
  const skillInstructions = getRalphSkillInstructions();
  const prompt = `${skillInstructions}

---

## PRD to Convert

${prdText}`;

  // Spinner will be stopped automatically when Claude starts outputting
  await runClaude(prompt, true, spinner);

  // Check if prd.json was created (with retry for file system timing)
  const checkFile = async (retries = 3, delay = 500) => {
    for (let i = 0; i < retries; i++) {
      if (fs.existsSync(PRD_FILE)) {
        try {
          // Verify it's valid JSON
          JSON.parse(fs.readFileSync(PRD_FILE, 'utf-8'));
          return true;
        } catch {
          // File exists but isn't valid JSON yet, wait and retry
        }
      }
      if (i < retries - 1) {
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
    return false;
  };

  if (await checkFile()) {
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

    // Show loading spinner until Claude starts outputting
    const startSpinner = new Spinner(`Iteration ${i}/${maxIterations}: Reading prd.json and selecting next user story...`, colors.cyan).start();

    // Spinner will be stopped automatically when Claude starts outputting
    const { output } = await runClaude(promptContent, true, startSpinner);

    // Check for completion signal
    if (output.includes(COMPLETION_SIGNAL)) {
      console.log('');
      log('Ralph completed all tasks!', colors.green + colors.bright);
      log(`Completed at iteration ${i} of ${maxIterations}`, colors.green);
      return true;
    }

    // Brief pause between iterations
    const pauseSpinner = new Spinner(`Iteration ${i} complete. Preparing iteration ${i + 1}...`, colors.dim).start();
    await new Promise(resolve => setTimeout(resolve, 2000));
    pauseSpinner.stop();
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

// Ensure output directory exists
function ensureOutputDir() {
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }
}

// Main function
async function main() {
  const { inputFile, maxIterations } = parseArgs();

  // Ensure output directory exists
  ensureOutputDir();

  log('Claude-All Agent System', colors.cyan + colors.bright);
  log('═'.repeat(55), colors.cyan);
  log(`Working directory: ${WORKING_DIR}`, colors.dim);
  log(`Output directory: ${OUTPUT_DIR}`, colors.dim);

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
