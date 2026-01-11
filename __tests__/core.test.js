/**
 * Tests for core library exports
 */

const path = require('path');
const fs = require('fs');
const os = require('os');

// Test the exports from the library
const claudeAll = require('../lib/index');
const core = require('../lib/core');

describe('Library Exports', () => {
  it('should export all expected functions from main entry point', () => {
    // Core functions
    expect(typeof claudeAll.createConfig).toBe('function');
    expect(typeof claudeAll.runClaude).toBe('function');
    expect(typeof claudeAll.generatePrdJson).toBe('function');
    expect(typeof claudeAll.runAgentLoop).toBe('function');

    // Status functions
    expect(typeof claudeAll.hasPrdJson).toBe('function');
    expect(typeof claudeAll.hasIncompleteStories).toBe('function');

    // File utilities
    expect(typeof claudeAll.ensureOutputDir).toBe('function');
    expect(typeof claudeAll.initProgressFile).toBe('function');
    expect(typeof claudeAll.archivePreviousRun).toBe('function');
    expect(typeof claudeAll.trackCurrentBranch).toBe('function');

    // UI utilities
    expect(typeof claudeAll.Spinner).toBe('function');

    // Constants
    expect(typeof claudeAll.colors).toBe('object');
    expect(typeof claudeAll.COMPLETION_SIGNAL).toBe('string');
  });

  it('should export all expected functions from core module', () => {
    expect(typeof core.createConfig).toBe('function');
    expect(typeof core.runClaude).toBe('function');
    expect(typeof core.generatePrdJson).toBe('function');
    expect(typeof core.runAgentLoop).toBe('function');
    expect(typeof core.hasPrdJson).toBe('function');
    expect(typeof core.hasIncompleteStories).toBe('function');
    expect(typeof core.Spinner).toBe('function');
  });
});

describe('createConfig', () => {
  it('should create config with default values', () => {
    const config = core.createConfig();

    expect(config.WORKING_DIR).toBe(process.cwd());
    expect(config.OUTPUT_DIR).toBe(path.join(process.cwd(), 'output'));
    expect(config.PRD_FILE).toBe(path.join(process.cwd(), 'output', 'prd.json'));
    expect(config.PROGRESS_FILE).toBe(path.join(process.cwd(), 'output', 'progress.txt'));
    expect(config.COMPLETION_SIGNAL).toBe('<promise>COMPLETE</promise>');
  });

  it('should create config with custom working directory', () => {
    const customDir = '/custom/project';
    const config = core.createConfig({ workingDir: customDir });

    expect(config.WORKING_DIR).toBe(customDir);
    expect(config.OUTPUT_DIR).toBe(path.join(customDir, 'output'));
    expect(config.PRD_FILE).toBe(path.join(customDir, 'output', 'prd.json'));
  });

  it('should create config with custom script directory', () => {
    const customScriptDir = '/custom/scripts';
    const config = core.createConfig({ scriptDir: customScriptDir });

    expect(config.SCRIPT_DIR).toBe(customScriptDir);
    expect(config.PROMPT_FILE).toBe(path.join(customScriptDir, 'lib', 'prompt.md'));
  });
});

describe('hasPrdJson', () => {
  let tempDir;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'hasPrdJson-'));
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it('should return false for non-existent file', () => {
    const result = core.hasPrdJson(path.join(tempDir, 'nonexistent.json'));
    expect(result).toBe(false);
  });

  it('should return false for invalid JSON', () => {
    const filePath = path.join(tempDir, 'invalid.json');
    fs.writeFileSync(filePath, '{ invalid json }');
    expect(core.hasPrdJson(filePath)).toBe(false);
  });

  it('should return true for valid JSON', () => {
    const filePath = path.join(tempDir, 'valid.json');
    fs.writeFileSync(filePath, JSON.stringify({ project: 'test' }));
    expect(core.hasPrdJson(filePath)).toBe(true);
  });
});

describe('hasIncompleteStories', () => {
  let tempDir;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'hasIncomplete-'));
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it('should return exists:false for non-existent file', () => {
    const result = core.hasIncompleteStories(path.join(tempDir, 'nonexistent.json'));
    expect(result.exists).toBe(false);
    expect(result.incomplete).toBe(false);
  });

  it('should detect incomplete stories', () => {
    const filePath = path.join(tempDir, 'prd.json');
    const prd = {
      project: 'Test Project',
      userStories: [
        { id: 'US-001', passes: true },
        { id: 'US-002', passes: false },
        { id: 'US-003', passes: false },
      ],
    };
    fs.writeFileSync(filePath, JSON.stringify(prd));

    const result = core.hasIncompleteStories(filePath);
    expect(result.exists).toBe(true);
    expect(result.incomplete).toBe(true);
    expect(result.total).toBe(3);
    expect(result.completed).toBe(1);
    expect(result.remaining).toBe(2);
    expect(result.projectName).toBe('Test Project');
  });

  it('should detect all stories complete', () => {
    const filePath = path.join(tempDir, 'prd.json');
    const prd = {
      project: 'Complete Project',
      userStories: [
        { id: 'US-001', passes: true },
        { id: 'US-002', passes: true },
      ],
    };
    fs.writeFileSync(filePath, JSON.stringify(prd));

    const result = core.hasIncompleteStories(filePath);
    expect(result.exists).toBe(true);
    expect(result.incomplete).toBe(false);
    expect(result.total).toBe(2);
    expect(result.completed).toBe(2);
    expect(result.remaining).toBe(0);
  });

  it('should handle empty userStories array', () => {
    const filePath = path.join(tempDir, 'prd.json');
    fs.writeFileSync(filePath, JSON.stringify({ project: 'Empty', userStories: [] }));

    const result = core.hasIncompleteStories(filePath);
    expect(result.exists).toBe(true);
    expect(result.incomplete).toBe(false);
    expect(result.total).toBe(0);
  });

  it('should use branchName as fallback for projectName', () => {
    const filePath = path.join(tempDir, 'prd.json');
    fs.writeFileSync(filePath, JSON.stringify({ branchName: 'ralph/feature', userStories: [] }));

    const result = core.hasIncompleteStories(filePath);
    expect(result.projectName).toBe('ralph/feature');
  });
});

describe('ensureOutputDir', () => {
  let tempDir;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ensureDir-'));
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it('should create directory if it does not exist', () => {
    const outputDir = path.join(tempDir, 'new', 'nested', 'output');
    expect(fs.existsSync(outputDir)).toBe(false);

    core.ensureOutputDir(outputDir);

    expect(fs.existsSync(outputDir)).toBe(true);
  });

  it('should not throw if directory already exists', () => {
    const outputDir = path.join(tempDir, 'existing');
    fs.mkdirSync(outputDir);

    expect(() => core.ensureOutputDir(outputDir)).not.toThrow();
  });
});

describe('initProgressFile', () => {
  let tempDir;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'initProgress-'));
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it('should create progress file with header', () => {
    const progressFile = path.join(tempDir, 'progress.txt');
    core.initProgressFile(progressFile);

    expect(fs.existsSync(progressFile)).toBe(true);
    const content = fs.readFileSync(progressFile, 'utf-8');
    expect(content).toContain('# Ralph Progress Log');
    expect(content).toContain('Started:');
  });

  it('should not overwrite existing progress file', () => {
    const progressFile = path.join(tempDir, 'progress.txt');
    fs.writeFileSync(progressFile, 'Existing content');

    core.initProgressFile(progressFile);

    const content = fs.readFileSync(progressFile, 'utf-8');
    expect(content).toBe('Existing content');
  });
});

describe('Spinner', () => {
  it('should create spinner with single message', () => {
    const spinner = new core.Spinner('Loading...');
    expect(spinner.messages).toEqual(['Loading...']);
  });

  it('should create spinner with multiple messages', () => {
    const messages = ['Loading...', 'Processing...', 'Almost done...'];
    const spinner = new core.Spinner(messages);
    expect(spinner.messages).toEqual(messages);
  });

  it('should update message', () => {
    const spinner = new core.Spinner('Initial');
    spinner.update('Updated');
    expect(spinner.messages).toEqual(['Updated']);
  });
});

describe('colors', () => {
  it('should export color codes', () => {
    expect(core.colors.reset).toBe('\x1b[0m');
    expect(core.colors.green).toBe('\x1b[32m');
    expect(core.colors.red).toBe('\x1b[31m');
    expect(core.colors.yellow).toBe('\x1b[33m');
    expect(core.colors.cyan).toBe('\x1b[36m');
  });

  it('should export cursor control codes', () => {
    expect(core.colors.hideCursor).toBe('\x1b[?25l');
    expect(core.colors.showCursor).toBe('\x1b[?25h');
    expect(core.colors.clearLine).toBe('\x1b[2K\r');
  });
});

describe('COMPLETION_SIGNAL', () => {
  it('should be the expected signal string', () => {
    expect(core.COMPLETION_SIGNAL).toBe('<promise>COMPLETE</promise>');
  });
});

describe('getRalphSkillInstructions', () => {
  it('should return skill instructions from script directory', () => {
    const scriptDir = path.join(__dirname, '..');
    const instructions = core.getRalphSkillInstructions(scriptDir);

    expect(instructions).toContain('prd.json');
    expect(instructions.length).toBeGreaterThan(100);
  });

  it('should return fallback instructions for invalid directory', () => {
    const instructions = core.getRalphSkillInstructions('/nonexistent/dir');
    expect(instructions).toContain('prd.json');
    expect(instructions).toContain('output');
  });
});
