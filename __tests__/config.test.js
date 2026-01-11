/**
 * Tests for configuration module
 */

const path = require('path');
const { createConfig } = require('../lib/config');

describe('createConfig', () => {
  it('should create config with default directories', () => {
    const config = createConfig('/test/project', '/test/script');

    expect(config.WORKING_DIR).toBe('/test/project');
    expect(config.SCRIPT_DIR).toBe('/test/script');
    expect(config.OUTPUT_DIR).toBe('/test/project/output');
    expect(config.PRD_FILE).toBe('/test/project/output/prd.json');
    expect(config.PROGRESS_FILE).toBe('/test/project/output/progress.txt');
    expect(config.ARCHIVE_DIR).toBe('/test/project/output/archive');
    expect(config.LAST_BRANCH_FILE).toBe('/test/project/output/.last-branch');
    expect(config.PROMPT_FILE).toBe('/test/script/lib/prompt.md');
    expect(config.COMPLETION_SIGNAL).toBe('<promise>COMPLETE</promise>');
  });

  it('should use process.cwd() as default working directory', () => {
    const config = createConfig();

    expect(config.WORKING_DIR).toBe(process.cwd());
    expect(config.OUTPUT_DIR).toBe(path.join(process.cwd(), 'output'));
  });

  it('should correctly resolve paths for different working directories', () => {
    const config1 = createConfig('/project/a', '/scripts');
    const config2 = createConfig('/project/b', '/scripts');

    // Same script directory should point to same prompt file
    expect(config1.PROMPT_FILE).toBe(config2.PROMPT_FILE);

    // Different working directories should have different output locations
    expect(config1.OUTPUT_DIR).not.toBe(config2.OUTPUT_DIR);
    expect(config1.PRD_FILE).not.toBe(config2.PRD_FILE);
  });

  it('should handle paths with spaces', () => {
    const config = createConfig('/test/my project', '/test/my scripts');

    expect(config.WORKING_DIR).toBe('/test/my project');
    expect(config.OUTPUT_DIR).toBe('/test/my project/output');
    expect(config.PRD_FILE).toBe('/test/my project/output/prd.json');
  });
});
