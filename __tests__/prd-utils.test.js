/**
 * Tests for PRD utility functions
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const {
  hasPrdJson,
  readPrdFile,
  validatePrdJson,
  ensureOutputDir,
  initProgressFile,
  trackCurrentBranch,
  parseArgs,
} = require('../lib/prd-utils');

describe('hasPrdJson', () => {
  let tempDir;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'claude-all-test-'));
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it('should return false when file does not exist', () => {
    const result = hasPrdJson(path.join(tempDir, 'nonexistent.json'));
    expect(result).toBe(false);
  });

  it('should return false when file contains invalid JSON', () => {
    const filePath = path.join(tempDir, 'invalid.json');
    fs.writeFileSync(filePath, 'not valid json {{{');

    const result = hasPrdJson(filePath);
    expect(result).toBe(false);
  });

  it('should return true when file contains valid JSON', () => {
    const filePath = path.join(tempDir, 'valid.json');
    fs.writeFileSync(filePath, JSON.stringify({ project: 'test' }));

    const result = hasPrdJson(filePath);
    expect(result).toBe(true);
  });

  it('should return true for empty JSON object', () => {
    const filePath = path.join(tempDir, 'empty.json');
    fs.writeFileSync(filePath, '{}');

    const result = hasPrdJson(filePath);
    expect(result).toBe(true);
  });

  it('should return true for JSON array', () => {
    const filePath = path.join(tempDir, 'array.json');
    fs.writeFileSync(filePath, '[]');

    const result = hasPrdJson(filePath);
    expect(result).toBe(true);
  });
});

describe('readPrdFile', () => {
  let tempDir;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'claude-all-test-'));
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it('should throw error when file does not exist', () => {
    expect(() => {
      readPrdFile(path.join(tempDir, 'nonexistent.md'));
    }).toThrow(/File not found/);
  });

  it('should read file contents successfully', () => {
    const filePath = path.join(tempDir, 'test.md');
    const content = '# Test PRD\n\nThis is a test.';
    fs.writeFileSync(filePath, content);

    const result = readPrdFile(filePath);
    expect(result).toBe(content);
  });

  it('should resolve relative paths', () => {
    const filePath = path.join(tempDir, 'test.md');
    fs.writeFileSync(filePath, 'content');

    // Create a relative path
    const relativePath = path.relative(process.cwd(), filePath);

    const result = readPrdFile(relativePath);
    expect(result).toBe('content');
  });
});

describe('validatePrdJson', () => {
  const validPrd = {
    project: 'Test Project',
    branchName: 'ralph/test-project',
    description: 'A test project',
    userStories: [
      {
        id: 'US-001',
        title: 'First story',
        description: 'As a user, I want to test',
        acceptanceCriteria: ['Criterion 1'],
        priority: 1,
        passes: false,
        notes: '',
      },
    ],
  };

  it('should validate a correct prd.json', () => {
    const result = validatePrdJson(validPrd);

    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('should detect missing project field', () => {
    const prd = { ...validPrd, project: undefined };

    const result = validatePrdJson(prd);

    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Missing or invalid "project" field');
  });

  it('should detect missing branchName field', () => {
    const prd = { ...validPrd, branchName: undefined };

    const result = validatePrdJson(prd);

    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Missing or invalid "branchName" field');
  });

  it('should detect branchName not starting with ralph/', () => {
    const prd = { ...validPrd, branchName: 'feature/test' };

    const result = validatePrdJson(prd);

    expect(result.valid).toBe(false);
    expect(result.errors).toContain('branchName must start with "ralph/"');
  });

  it('should detect missing description field', () => {
    const prd = { ...validPrd, description: undefined };

    const result = validatePrdJson(prd);

    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Missing or invalid "description" field');
  });

  it('should detect missing userStories array', () => {
    const prd = { ...validPrd, userStories: 'not an array' };

    const result = validatePrdJson(prd);

    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Missing or invalid "userStories" array');
  });

  it('should validate user story fields', () => {
    const prd = {
      ...validPrd,
      userStories: [
        {
          id: 'US-001',
          // missing title
          description: 'Test',
          acceptanceCriteria: [],
          priority: 1,
          passes: false,
          notes: '',
        },
      ],
    };

    const result = validatePrdJson(prd);

    expect(result.valid).toBe(false);
    expect(result.errors).toContain('userStories[0]: Missing or invalid "title" field');
  });

  it('should detect non-sequential priorities', () => {
    const prd = {
      ...validPrd,
      userStories: [
        { ...validPrd.userStories[0], id: 'US-001', priority: 1 },
        { ...validPrd.userStories[0], id: 'US-002', priority: 3 }, // Skipped 2
      ],
    };

    const result = validatePrdJson(prd);

    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('sequential'))).toBe(true);
  });

  it('should detect non-sequential IDs', () => {
    const prd = {
      ...validPrd,
      userStories: [
        { ...validPrd.userStories[0], id: 'US-001', priority: 1 },
        { ...validPrd.userStories[0], id: 'US-003', priority: 2 }, // Skipped US-002
      ],
    };

    const result = validatePrdJson(prd);

    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('sequential'))).toBe(true);
  });

  it('should require passes to be boolean', () => {
    const prd = {
      ...validPrd,
      userStories: [{ ...validPrd.userStories[0], passes: 'false' }],
    };

    const result = validatePrdJson(prd);

    expect(result.valid).toBe(false);
    expect(result.errors).toContain('userStories[0]: Missing or invalid "passes" field (must be boolean)');
  });

  it('should require priority to be number', () => {
    const prd = {
      ...validPrd,
      userStories: [{ ...validPrd.userStories[0], priority: '1' }],
    };

    const result = validatePrdJson(prd);

    expect(result.valid).toBe(false);
    expect(result.errors).toContain('userStories[0]: Missing or invalid "priority" field (must be number)');
  });
});

describe('ensureOutputDir', () => {
  let tempDir;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'claude-all-test-'));
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it('should create directory if it does not exist', () => {
    const outputDir = path.join(tempDir, 'output');

    expect(fs.existsSync(outputDir)).toBe(false);

    ensureOutputDir(outputDir);

    expect(fs.existsSync(outputDir)).toBe(true);
    expect(fs.statSync(outputDir).isDirectory()).toBe(true);
  });

  it('should not throw if directory already exists', () => {
    const outputDir = path.join(tempDir, 'output');
    fs.mkdirSync(outputDir);

    expect(() => ensureOutputDir(outputDir)).not.toThrow();
  });

  it('should create nested directories', () => {
    const outputDir = path.join(tempDir, 'deep', 'nested', 'output');

    ensureOutputDir(outputDir);

    expect(fs.existsSync(outputDir)).toBe(true);
  });
});

describe('initProgressFile', () => {
  let tempDir;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'claude-all-test-'));
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it('should create progress file if it does not exist', () => {
    const progressFile = path.join(tempDir, 'progress.txt');

    initProgressFile(progressFile);

    expect(fs.existsSync(progressFile)).toBe(true);
    const content = fs.readFileSync(progressFile, 'utf-8');
    expect(content).toContain('# Ralph Progress Log');
    expect(content).toContain('Started:');
  });

  it('should not overwrite existing progress file', () => {
    const progressFile = path.join(tempDir, 'progress.txt');
    const existingContent = '# Existing Progress\n\nSome content here';
    fs.writeFileSync(progressFile, existingContent);

    initProgressFile(progressFile);

    const content = fs.readFileSync(progressFile, 'utf-8');
    expect(content).toBe(existingContent);
  });
});

describe('trackCurrentBranch', () => {
  let tempDir;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'claude-all-test-'));
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it('should do nothing if prd.json does not exist', () => {
    const prdFile = path.join(tempDir, 'prd.json');
    const lastBranchFile = path.join(tempDir, '.last-branch');

    trackCurrentBranch(prdFile, lastBranchFile);

    expect(fs.existsSync(lastBranchFile)).toBe(false);
  });

  it('should write branch name to file', () => {
    const prdFile = path.join(tempDir, 'prd.json');
    const lastBranchFile = path.join(tempDir, '.last-branch');

    fs.writeFileSync(prdFile, JSON.stringify({ branchName: 'ralph/test-feature' }));

    trackCurrentBranch(prdFile, lastBranchFile);

    expect(fs.existsSync(lastBranchFile)).toBe(true);
    expect(fs.readFileSync(lastBranchFile, 'utf-8')).toBe('ralph/test-feature');
  });

  it('should handle invalid JSON gracefully', () => {
    const prdFile = path.join(tempDir, 'prd.json');
    const lastBranchFile = path.join(tempDir, '.last-branch');

    fs.writeFileSync(prdFile, 'invalid json');

    expect(() => trackCurrentBranch(prdFile, lastBranchFile)).not.toThrow();
    expect(fs.existsSync(lastBranchFile)).toBe(false);
  });

  it('should not write if branchName is missing', () => {
    const prdFile = path.join(tempDir, 'prd.json');
    const lastBranchFile = path.join(tempDir, '.last-branch');

    fs.writeFileSync(prdFile, JSON.stringify({ project: 'test' }));

    trackCurrentBranch(prdFile, lastBranchFile);

    expect(fs.existsSync(lastBranchFile)).toBe(false);
  });
});

describe('parseArgs', () => {
  it('should return defaults when no args provided', () => {
    const result = parseArgs([]);

    expect(result.inputFile).toBeNull();
    expect(result.maxIterations).toBe(10);
  });

  it('should parse input file argument', () => {
    const result = parseArgs(['my-prd.md']);

    expect(result.inputFile).toBe('my-prd.md');
    expect(result.maxIterations).toBe(10);
  });

  it('should parse --max-iterations argument', () => {
    const result = parseArgs(['--max-iterations', '5']);

    expect(result.inputFile).toBeNull();
    expect(result.maxIterations).toBe(5);
  });

  it('should parse both file and max-iterations', () => {
    const result = parseArgs(['my-prd.md', '--max-iterations', '20']);

    expect(result.inputFile).toBe('my-prd.md');
    expect(result.maxIterations).toBe(20);
  });

  it('should handle arguments in any order', () => {
    const result = parseArgs(['--max-iterations', '15', 'other-prd.md']);

    expect(result.inputFile).toBe('other-prd.md');
    expect(result.maxIterations).toBe(15);
  });

  it('should ignore unknown flags', () => {
    const result = parseArgs(['--unknown-flag', 'my-prd.md']);

    expect(result.inputFile).toBe('my-prd.md');
  });

  it('should handle path with spaces', () => {
    const result = parseArgs(['/path/to/my prd file.md']);

    expect(result.inputFile).toBe('/path/to/my prd file.md');
  });
});
