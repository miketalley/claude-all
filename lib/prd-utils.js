/**
 * PRD utility functions for claude-all
 * Contains testable functions for PRD operations
 */

const fs = require('fs');
const path = require('path');

/**
 * Check if a prd.json file exists and contains valid JSON
 * @param {string} prdFilePath - Path to prd.json
 * @returns {boolean} True if file exists and is valid JSON
 */
function hasPrdJson(prdFilePath) {
  if (!fs.existsSync(prdFilePath)) {
    return false;
  }
  try {
    JSON.parse(fs.readFileSync(prdFilePath, 'utf-8'));
    return true;
  } catch {
    return false;
  }
}

/**
 * Read PRD content from a file
 * @param {string} filePath - Path to the PRD file
 * @returns {string} File contents
 * @throws {Error} If file doesn't exist
 */
function readPrdFile(filePath) {
  const resolvedPath = path.resolve(filePath);
  if (!fs.existsSync(resolvedPath)) {
    throw new Error(`File not found: ${resolvedPath}`);
  }
  return fs.readFileSync(resolvedPath, 'utf-8');
}

/**
 * Validate prd.json structure
 * @param {Object} prd - Parsed prd.json object
 * @returns {Object} Validation result { valid: boolean, errors: string[] }
 */
function validatePrdJson(prd) {
  const errors = [];

  // Check required top-level fields
  if (!prd.project || typeof prd.project !== 'string') {
    errors.push('Missing or invalid "project" field');
  }

  if (!prd.branchName || typeof prd.branchName !== 'string') {
    errors.push('Missing or invalid "branchName" field');
  } else if (!prd.branchName.startsWith('ralph/')) {
    errors.push('branchName must start with "ralph/"');
  }

  if (!prd.description || typeof prd.description !== 'string') {
    errors.push('Missing or invalid "description" field');
  }

  if (!Array.isArray(prd.userStories)) {
    errors.push('Missing or invalid "userStories" array');
  } else {
    // Validate each user story
    prd.userStories.forEach((story, index) => {
      const storyPrefix = `userStories[${index}]`;

      if (!story.id || typeof story.id !== 'string') {
        errors.push(`${storyPrefix}: Missing or invalid "id" field`);
      }

      if (!story.title || typeof story.title !== 'string') {
        errors.push(`${storyPrefix}: Missing or invalid "title" field`);
      }

      if (!story.description || typeof story.description !== 'string') {
        errors.push(`${storyPrefix}: Missing or invalid "description" field`);
      }

      if (!Array.isArray(story.acceptanceCriteria)) {
        errors.push(`${storyPrefix}: Missing or invalid "acceptanceCriteria" array`);
      }

      if (typeof story.priority !== 'number') {
        errors.push(`${storyPrefix}: Missing or invalid "priority" field (must be number)`);
      }

      if (typeof story.passes !== 'boolean') {
        errors.push(`${storyPrefix}: Missing or invalid "passes" field (must be boolean)`);
      }

      if (typeof story.notes !== 'string') {
        errors.push(`${storyPrefix}: Missing or invalid "notes" field (must be string)`);
      }
    });

    // Check for sequential priorities
    const priorities = prd.userStories.map(s => s.priority).sort((a, b) => a - b);
    for (let i = 0; i < priorities.length; i++) {
      if (priorities[i] !== i + 1) {
        errors.push(`Priority numbers should be sequential starting from 1`);
        break;
      }
    }

    // Check for sequential IDs
    const ids = prd.userStories.map(s => s.id);
    for (let i = 0; i < ids.length; i++) {
      const expectedId = `US-${String(i + 1).padStart(3, '0')}`;
      if (ids[i] !== expectedId) {
        errors.push(`Story IDs should be sequential (expected ${expectedId}, got ${ids[i]})`);
        break;
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
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
 * Initialize progress file if it doesn't exist
 * @param {string} progressFilePath - Path to progress file
 */
function initProgressFile(progressFilePath) {
  if (!fs.existsSync(progressFilePath)) {
    fs.writeFileSync(
      progressFilePath,
      `# Ralph Progress Log\nStarted: ${new Date().toISOString()}\n---\n`
    );
  }
}

/**
 * Track the current branch in a file
 * @param {string} prdFilePath - Path to prd.json
 * @param {string} lastBranchFilePath - Path to .last-branch file
 */
function trackCurrentBranch(prdFilePath, lastBranchFilePath) {
  if (!fs.existsSync(prdFilePath)) {
    return;
  }

  try {
    const prd = JSON.parse(fs.readFileSync(prdFilePath, 'utf-8'));
    if (prd.branchName) {
      fs.writeFileSync(lastBranchFilePath, prd.branchName);
    }
  } catch {
    // Ignore errors
  }
}

/**
 * Parse command line arguments
 * @param {string[]} args - Array of command line arguments (typically process.argv.slice(2))
 * @returns {Object} Parsed arguments { inputFile, maxIterations }
 */
function parseArgs(args = []) {
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

module.exports = {
  hasPrdJson,
  readPrdFile,
  validatePrdJson,
  ensureOutputDir,
  initProgressFile,
  trackCurrentBranch,
  parseArgs,
};
