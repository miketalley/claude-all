#!/usr/bin/env node

/**
 * Claude-All CLI - Long-running AI agent loop with PRD generation
 *
 * Usage:
 *   claude-all                     - Resume existing PRD or prompt for new one
 *   claude-all <prd-file.md>       - Generate PRD from markdown file
 *   claude-all --max-iterations N  - Set max iterations (default: 10)
 *
 * Behavior when run without arguments:
 *   1. Checks for existing output/prd.json with incomplete stories
 *   2. If found, resumes working on remaining stories
 *   3. If not found, prompts for project description to generate new PRD
 */

const fs = require('fs');
const path = require('path');
const readline = require('readline');

// Import from library
const {
  createConfig,
  colors,
  runClaude,
  generatePrdJson,
  runAgentLoop,
  hasPrdJson,
  hasIncompleteStories,
  ensureOutputDir,
  initProgressFile,
  archivePreviousRun,
  trackCurrentBranch,
} = require('./lib/core');

function log(message, color = '') {
  console.log(`${color}${message}${colors.reset}`);
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

// Main function
async function main() {
  const { inputFile, maxIterations } = parseArgs();

  // Create configuration
  const config = createConfig();

  // Ensure output directory exists
  ensureOutputDir(config.OUTPUT_DIR);

  log('Claude-All Agent System', colors.cyan + colors.bright);
  log('═'.repeat(55), colors.cyan);
  log(`Working directory: ${config.WORKING_DIR}`, colors.dim);
  log(`Output directory: ${config.OUTPUT_DIR}`, colors.dim);

  // If an input file was specified, use that to generate a new PRD
  if (inputFile) {
    log(`\nReading PRD from: ${inputFile}`, colors.blue);
    const prdText = readPrdFile(inputFile);

    // Generate prd.json from the input
    const success = await generatePrdJson(prdText, config);
    if (!success) {
      log('Failed to generate prd.json. Please try again.', colors.red);
      process.exit(1);
    }
  } else {
    // No input file specified - check for existing incomplete PRD
    const status = hasIncompleteStories(config.PRD_FILE);

    if (status.exists && status.incomplete) {
      // Found existing PRD with incomplete stories - resume
      log(`\nFound existing PRD: ${status.projectName}`, colors.blue);
      log(`Progress: ${status.completed}/${status.total} stories complete, ${status.remaining} remaining`, colors.blue);
      log('Resuming agent loop...', colors.blue);
    } else if (status.exists && !status.incomplete) {
      // PRD exists but all stories are complete
      log('\nExisting PRD found but all stories are already complete!', colors.green);
      log(`Project: ${status.projectName} (${status.total}/${status.total} stories complete)`, colors.dim);
      log('\nTo start a new project:', colors.yellow);
      log('  • Run with a .md file: claude-all your-prd.md', colors.dim);
      log('  • Or delete output/prd.json and run again to enter text manually', colors.dim);
      process.exit(0);
    } else {
      // No existing PRD - prompt for input
      log('\nNo existing PRD with incomplete stories found.', colors.yellow);
      log('You can:', colors.dim);
      log('  • Enter a project description below', colors.dim);
      log('  • Or run with a .md file: claude-all your-prd.md', colors.dim);

      const prdText = await promptForInput();

      if (!prdText) {
        log('No input provided. Exiting.', colors.red);
        process.exit(1);
      }

      // Generate prd.json from the input
      const success = await generatePrdJson(prdText, config);
      if (!success) {
        log('Failed to generate prd.json. Please try again.', colors.red);
        process.exit(1);
      }
    }
  }

  // Archive previous run if needed
  archivePreviousRun(config);

  // Track current branch
  trackCurrentBranch(config);

  // Initialize progress file
  initProgressFile(config.PROGRESS_FILE);

  // Run the agent loop
  const completed = await runAgentLoop(config, { maxIterations });

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
