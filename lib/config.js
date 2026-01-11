/**
 * Configuration module for claude-all
 * Separates configuration from the main script for testability
 */

const path = require('path');

/**
 * Create configuration object based on working directory
 * @param {string} workingDir - The working directory (defaults to process.cwd())
 * @param {string} scriptDir - The script directory (defaults to parent of this file)
 * @returns {Object} Configuration object
 */
function createConfig(workingDir = process.cwd(), scriptDir = path.join(__dirname, '..')) {
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
    COMPLETION_SIGNAL: '<promise>COMPLETE</promise>',
  };
}

module.exports = { createConfig };
