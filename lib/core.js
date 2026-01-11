/**
 * Core functionality for claude-all
 * This module exports the main functions for programmatic use
 */

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

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

// Completion signal that Claude outputs when all stories are done
const COMPLETION_SIGNAL = '<promise>COMPLETE</promise>';

/**
 * Loading spinner with braille animation
 */
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

    this.interval = setInterval(() => {
      this.frameIndex = (this.frameIndex + 1) % this.frames.length;
      this.render();
    }, 80);

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

  update(message) {
    this.messages = [message];
    this.messageIndex = 0;
  }
}

/**
 * Create configuration object for a working directory
 * @param {Object} options - Configuration options
 * @param {string} options.workingDir - The working directory (defaults to process.cwd())
 * @param {string} options.scriptDir - The script directory (defaults to claude-all install location)
 * @returns {Object} Configuration object with all paths
 */
function createConfig(options = {}) {
  const scriptDir = options.scriptDir || path.join(__dirname, '..');
  const workingDir = options.workingDir || process.cwd();
  const outputDir = path.join(workingDir, 'output');

  return {
    SCRIPT_DIR: scriptDir,
    WORKING_DIR: workingDir,
    OUTPUT_DIR: outputDir,
    PRD_FILE: path.join(outputDir, 'prd.json'),
    PROGRESS_FILE: path.join(outputDir, 'progress.txt'),
    ARCHIVE_DIR: path.join(outputDir, 'archive'),
    LAST_BRANCH_FILE: path.join(outputDir, '.last-branch'),
    PROMPT_FILE: path.join(scriptDir, 'lib', 'prompt.md'),
    COMPLETION_SIGNAL,
  };
}

/**
 * Run Claude with a prompt
 * @param {string} prompt - The prompt to send to Claude
 * @param {Object} options - Options
 * @param {boolean} options.streamOutput - Whether to stream output to stdout (default: true)
 * @param {Spinner} options.spinner - Optional spinner to stop when output starts
 * @param {string} options.cwd - Working directory for Claude (default: process.cwd())
 * @returns {Promise<{output: string, code: number}>}
 */
function runClaude(prompt, options = {}) {
  const { streamOutput = true, spinner = null, cwd = process.cwd() } = options;

  return new Promise((resolve, reject) => {
    const claude = spawn('claude', ['--dangerously-skip-permissions'], {
      stdio: ['pipe', 'pipe', 'pipe'],
      shell: true,
      cwd,
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
      stopSpinnerOnce();
      resolve({ output, code });
    });

    claude.on('error', (err) => {
      stopSpinnerOnce();
      reject(err);
    });
  });
}

/**
 * Check if prd.json exists and is valid
 * @param {string} prdFile - Path to prd.json
 * @returns {boolean}
 */
function hasPrdJson(prdFile) {
  if (!fs.existsSync(prdFile)) {
    return false;
  }
  try {
    JSON.parse(fs.readFileSync(prdFile, 'utf-8'));
    return true;
  } catch {
    return false;
  }
}

/**
 * Check if prd.json has incomplete user stories
 * @param {string} prdFile - Path to prd.json
 * @returns {Object} Status object with exists, incomplete, total, remaining, completed, projectName
 */
function hasIncompleteStories(prdFile) {
  if (!hasPrdJson(prdFile)) {
    return { exists: false, incomplete: false, total: 0, remaining: 0, completed: 0, projectName: null };
  }

  try {
    const prd = JSON.parse(fs.readFileSync(prdFile, 'utf-8'));
    const stories = prd.userStories || [];
    const incompleteStories = stories.filter(s => s.passes === false);

    return {
      exists: true,
      incomplete: incompleteStories.length > 0,
      total: stories.length,
      remaining: incompleteStories.length,
      completed: stories.length - incompleteStories.length,
      projectName: prd.project || prd.branchName || 'Unknown',
    };
  } catch {
    return { exists: false, incomplete: false, total: 0, remaining: 0, completed: 0, projectName: null };
  }
}

/**
 * Read the ralph skill instructions
 * @param {string} scriptDir - The script directory
 * @returns {string} Skill instructions
 */
function getRalphSkillInstructions(scriptDir) {
  const skillPath = path.join(scriptDir, '.claude', 'skills', 'ralph', 'SKILL.md');
  if (fs.existsSync(skillPath)) {
    return fs.readFileSync(skillPath, 'utf-8');
  }
  return `Convert the PRD to prd.json format. Save to output/prd.json in the current directory.`;
}

/**
 * Generate prd.json from PRD text
 * @param {string} prdText - The PRD text to convert
 * @param {Object} config - Configuration object from createConfig()
 * @param {Object} options - Options
 * @param {boolean} options.silent - Suppress console output (default: false)
 * @returns {Promise<boolean>} True if successful
 */
async function generatePrdJson(prdText, config, options = {}) {
  const { silent = false } = options;

  if (!silent) console.log('');
  const spinner = silent ? null : new Spinner('Converting PRD to prd.json format...', colors.yellow).start();

  const skillInstructions = getRalphSkillInstructions(config.SCRIPT_DIR);
  const prompt = `${skillInstructions}

---

## PRD to Convert

${prdText}`;

  await runClaude(prompt, {
    streamOutput: !silent,
    spinner,
    cwd: config.WORKING_DIR,
  });

  // Check if prd.json was created (with retry for file system timing)
  const checkFile = async (retries = 3, delay = 500) => {
    for (let i = 0; i < retries; i++) {
      if (fs.existsSync(config.PRD_FILE)) {
        try {
          JSON.parse(fs.readFileSync(config.PRD_FILE, 'utf-8'));
          return true;
        } catch {
          // File exists but isn't valid JSON yet
        }
      }
      if (i < retries - 1) {
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
    return false;
  };

  const success = await checkFile();
  if (!silent) {
    if (success) {
      console.log(`${colors.green}\nprd.json generated successfully!${colors.reset}`);
    } else {
      console.log(`${colors.yellow}\nWarning: prd.json may not have been created.${colors.reset}`);
    }
  }

  return success;
}

/**
 * Ensure output directory exists
 * @param {string} outputDir - Path to output directory
 */
function ensureOutputDir(outputDir) {
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }
}

/**
 * Initialize progress file
 * @param {string} progressFile - Path to progress file
 */
function initProgressFile(progressFile) {
  if (!fs.existsSync(progressFile)) {
    fs.writeFileSync(progressFile, `# Ralph Progress Log\nStarted: ${new Date().toISOString()}\n---\n`);
  }
}

/**
 * Run the main agent loop
 * @param {Object} config - Configuration object from createConfig()
 * @param {Object} options - Options
 * @param {number} options.maxIterations - Maximum iterations (default: 10)
 * @param {boolean} options.silent - Suppress console output (default: false)
 * @param {Function} options.onIteration - Callback called before each iteration with iteration number
 * @param {Function} options.onComplete - Callback called when all stories complete
 * @returns {Promise<boolean>} True if all stories completed
 */
async function runAgentLoop(config, options = {}) {
  const { maxIterations = 10, silent = false, onIteration, onComplete } = options;

  if (!silent) {
    console.log(`${colors.bright}\nStarting Ralph - Max iterations: ${maxIterations}${colors.reset}`);
  }

  const promptContent = fs.readFileSync(config.PROMPT_FILE, 'utf-8');

  for (let i = 1; i <= maxIterations; i++) {
    if (onIteration) onIteration(i, maxIterations);

    if (!silent) {
      console.log('');
      console.log(`${colors.cyan}${'═'.repeat(55)}${colors.reset}`);
      console.log(`${colors.cyan}  Ralph Iteration ${i} of ${maxIterations}${colors.reset}`);
      console.log(`${colors.cyan}${'═'.repeat(55)}${colors.reset}`);
    }

    const spinner = silent ? null : new Spinner(
      `Iteration ${i}/${maxIterations}: Reading prd.json and selecting next user story...`,
      colors.cyan
    ).start();

    const { output } = await runClaude(promptContent, {
      streamOutput: !silent,
      spinner,
      cwd: config.WORKING_DIR,
    });

    if (output.includes(config.COMPLETION_SIGNAL)) {
      if (!silent) {
        console.log('');
        console.log(`${colors.green}${colors.bright}Ralph completed all tasks!${colors.reset}`);
        console.log(`${colors.green}Completed at iteration ${i} of ${maxIterations}${colors.reset}`);
      }
      if (onComplete) onComplete(i);
      return true;
    }

    if (!silent && i < maxIterations) {
      const pauseSpinner = new Spinner(`Iteration ${i} complete. Preparing iteration ${i + 1}...`, colors.dim).start();
      await new Promise(resolve => setTimeout(resolve, 2000));
      pauseSpinner.stop();
    }
  }

  if (!silent) {
    console.log('');
    console.log(`${colors.yellow}Ralph reached max iterations (${maxIterations}) without completing all tasks.${colors.reset}`);
    console.log(`${colors.yellow}Check ${config.PROGRESS_FILE} for status.${colors.reset}`);
  }

  return false;
}

/**
 * Archive previous run if branch changed
 * @param {Object} config - Configuration object
 */
function archivePreviousRun(config) {
  if (!fs.existsSync(config.PRD_FILE) || !fs.existsSync(config.LAST_BRANCH_FILE)) {
    return;
  }

  try {
    const prd = JSON.parse(fs.readFileSync(config.PRD_FILE, 'utf-8'));
    const currentBranch = prd.branchName || '';
    const lastBranch = fs.readFileSync(config.LAST_BRANCH_FILE, 'utf-8').trim();

    if (currentBranch && lastBranch && currentBranch !== lastBranch) {
      const date = new Date().toISOString().split('T')[0];
      const folderName = lastBranch.replace(/^ralph\//, '');
      const archiveFolder = path.join(config.ARCHIVE_DIR, `${date}-${folderName}`);

      fs.mkdirSync(archiveFolder, { recursive: true });

      if (fs.existsSync(config.PRD_FILE)) {
        fs.copyFileSync(config.PRD_FILE, path.join(archiveFolder, 'prd.json'));
      }
      if (fs.existsSync(config.PROGRESS_FILE)) {
        fs.copyFileSync(config.PROGRESS_FILE, path.join(archiveFolder, 'progress.txt'));
      }

      fs.writeFileSync(config.PROGRESS_FILE, `# Ralph Progress Log\nStarted: ${new Date().toISOString()}\n---\n`);
    }
  } catch {
    // Ignore errors in archiving
  }
}

/**
 * Track current branch
 * @param {Object} config - Configuration object
 */
function trackCurrentBranch(config) {
  if (!fs.existsSync(config.PRD_FILE)) {
    return;
  }

  try {
    const prd = JSON.parse(fs.readFileSync(config.PRD_FILE, 'utf-8'));
    if (prd.branchName) {
      fs.writeFileSync(config.LAST_BRANCH_FILE, prd.branchName);
    }
  } catch {
    // Ignore errors
  }
}

module.exports = {
  // Configuration
  createConfig,
  colors,
  COMPLETION_SIGNAL,

  // Core functions
  runClaude,
  generatePrdJson,
  runAgentLoop,

  // Status functions
  hasPrdJson,
  hasIncompleteStories,

  // File utilities
  ensureOutputDir,
  initProgressFile,
  archivePreviousRun,
  trackCurrentBranch,
  getRalphSkillInstructions,

  // UI utilities
  Spinner,
};
