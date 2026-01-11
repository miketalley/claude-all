/**
 * Claude-All Library
 *
 * An autonomous agent system that uses Claude Code to incrementally build projects from a PRD.
 *
 * @example
 * const { createConfig, runAgentLoop, generatePrdJson } = require('claude-all');
 *
 * // Create config for current directory
 * const config = createConfig();
 *
 * // Generate PRD from text
 * await generatePrdJson('Build a todo app with add, delete, complete', config);
 *
 * // Run the agent loop
 * const success = await runAgentLoop(config, { maxIterations: 10 });
 */

const core = require('./core');
const prdUtils = require('./prd-utils');
const configModule = require('./config');

module.exports = {
  // Core functionality
  ...core,

  // PRD utilities (validation, etc.)
  validatePrdJson: prdUtils.validatePrdJson,
  readPrdFile: prdUtils.readPrdFile,

  // Config utilities (alternative API)
  createConfigFromModule: configModule.createConfig,
};
