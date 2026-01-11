/**
 * Integration tests for claude-all
 * Tests the full workflow path resolution and file creation
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const { createConfig } = require('../lib/config');
const {
  hasPrdJson,
  ensureOutputDir,
  initProgressFile,
  validatePrdJson,
} = require('../lib/prd-utils');

describe('Integration: Path Resolution', () => {
  let tempProjectDir;
  let tempScriptDir;

  beforeEach(() => {
    // Simulate a project directory (where user runs the command)
    tempProjectDir = fs.mkdtempSync(path.join(os.tmpdir(), 'project-'));
    // Simulate the script directory (where claude-all is installed)
    tempScriptDir = fs.mkdtempSync(path.join(os.tmpdir(), 'scripts-'));
  });

  afterEach(() => {
    fs.rmSync(tempProjectDir, { recursive: true, force: true });
    fs.rmSync(tempScriptDir, { recursive: true, force: true });
  });

  it('should create prd.json in the project directory, not the script directory', () => {
    // This test verifies the fix for the original bug
    // The bug was: prd.json was being checked in SCRIPT_DIR/output
    // but Claude was creating it in CWD/output (the project directory)

    const config = createConfig(tempProjectDir, tempScriptDir);

    // Ensure output directory exists in project dir
    ensureOutputDir(config.OUTPUT_DIR);

    // Create a mock prd.json
    const mockPrd = {
      project: 'Test',
      branchName: 'ralph/test',
      description: 'Test project',
      userStories: [
        {
          id: 'US-001',
          title: 'Test',
          description: 'Test',
          acceptanceCriteria: ['Test'],
          priority: 1,
          passes: false,
          notes: '',
        },
      ],
    };

    fs.writeFileSync(config.PRD_FILE, JSON.stringify(mockPrd, null, 2));

    // Verify the file was created in the project directory
    expect(fs.existsSync(config.PRD_FILE)).toBe(true);
    expect(config.PRD_FILE).toContain(tempProjectDir);
    expect(config.PRD_FILE).not.toContain(tempScriptDir);

    // Verify hasPrdJson finds it at the correct location
    expect(hasPrdJson(config.PRD_FILE)).toBe(true);

    // Verify the script directory does NOT have a prd.json
    const scriptPrdFile = path.join(tempScriptDir, 'output', 'prd.json');
    expect(fs.existsSync(scriptPrdFile)).toBe(false);
  });

  it('should create progress.txt in the project directory', () => {
    const config = createConfig(tempProjectDir, tempScriptDir);

    ensureOutputDir(config.OUTPUT_DIR);
    initProgressFile(config.PROGRESS_FILE);

    expect(fs.existsSync(config.PROGRESS_FILE)).toBe(true);
    expect(config.PROGRESS_FILE).toContain(tempProjectDir);

    const content = fs.readFileSync(config.PROGRESS_FILE, 'utf-8');
    expect(content).toContain('# Ralph Progress Log');
  });

  it('should keep prompt.md reference to script directory', () => {
    // The prompt.md should always be read from where claude-all is installed
    // This is intentional - it's part of the tool, not the project

    const config = createConfig(tempProjectDir, tempScriptDir);

    expect(config.PROMPT_FILE).toContain(tempScriptDir);
    expect(config.PROMPT_FILE).not.toContain(tempProjectDir);
  });

  it('should handle same directory for project and script', () => {
    // Edge case: running claude-all from its own directory
    const config = createConfig(tempProjectDir, tempProjectDir);

    expect(config.WORKING_DIR).toBe(tempProjectDir);
    expect(config.SCRIPT_DIR).toBe(tempProjectDir);
    expect(config.OUTPUT_DIR).toBe(path.join(tempProjectDir, 'output'));
    expect(config.PROMPT_FILE).toBe(path.join(tempProjectDir, 'lib', 'prompt.md'));
  });
});

describe('Integration: Full Workflow', () => {
  let tempDir;
  let config;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'workflow-'));
    config = createConfig(tempDir, tempDir);
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it('should complete the full setup workflow', () => {
    // Step 1: No prd.json exists initially
    expect(hasPrdJson(config.PRD_FILE)).toBe(false);

    // Step 2: Ensure output directory
    ensureOutputDir(config.OUTPUT_DIR);
    expect(fs.existsSync(config.OUTPUT_DIR)).toBe(true);

    // Step 3: Create prd.json (simulating what Claude would do)
    const prd = {
      project: 'Test App',
      branchName: 'ralph/test-app',
      description: 'A test application',
      userStories: [
        {
          id: 'US-001',
          title: 'Initialize project',
          description: 'As a developer, I need project setup',
          acceptanceCriteria: ['Project initialized', 'Typecheck passes'],
          priority: 1,
          passes: false,
          notes: '',
        },
        {
          id: 'US-002',
          title: 'Add feature',
          description: 'As a user, I want a feature',
          acceptanceCriteria: ['Feature works'],
          priority: 2,
          passes: false,
          notes: '',
        },
      ],
    };

    fs.writeFileSync(config.PRD_FILE, JSON.stringify(prd, null, 2));

    // Step 4: Verify prd.json exists and is valid
    expect(hasPrdJson(config.PRD_FILE)).toBe(true);

    const validation = validatePrdJson(prd);
    expect(validation.valid).toBe(true);

    // Step 5: Initialize progress file
    initProgressFile(config.PROGRESS_FILE);
    expect(fs.existsSync(config.PROGRESS_FILE)).toBe(true);

    // Step 6: Simulate completing a story
    prd.userStories[0].passes = true;
    prd.userStories[0].notes = 'Completed in iteration 1';
    fs.writeFileSync(config.PRD_FILE, JSON.stringify(prd, null, 2));

    // Verify the update persisted
    const updatedPrd = JSON.parse(fs.readFileSync(config.PRD_FILE, 'utf-8'));
    expect(updatedPrd.userStories[0].passes).toBe(true);
    expect(updatedPrd.userStories[1].passes).toBe(false);
  });

  it('should resume from existing prd.json', () => {
    ensureOutputDir(config.OUTPUT_DIR);

    // Create existing prd.json with some stories completed
    const existingPrd = {
      project: 'Existing Project',
      branchName: 'ralph/existing',
      description: 'Already in progress',
      userStories: [
        {
          id: 'US-001',
          title: 'Done story',
          description: 'Already done',
          acceptanceCriteria: ['Done'],
          priority: 1,
          passes: true,
          notes: 'Completed yesterday',
        },
        {
          id: 'US-002',
          title: 'Pending story',
          description: 'Still needs work',
          acceptanceCriteria: ['Not done yet'],
          priority: 2,
          passes: false,
          notes: '',
        },
      ],
    };

    fs.writeFileSync(config.PRD_FILE, JSON.stringify(existingPrd, null, 2));

    // Verify resume detection works
    expect(hasPrdJson(config.PRD_FILE)).toBe(true);

    // Read and verify state
    const prd = JSON.parse(fs.readFileSync(config.PRD_FILE, 'utf-8'));
    const pendingStories = prd.userStories.filter((s) => !s.passes);
    const completedStories = prd.userStories.filter((s) => s.passes);

    expect(pendingStories).toHaveLength(1);
    expect(completedStories).toHaveLength(1);
    expect(pendingStories[0].id).toBe('US-002');
  });
});

describe('Integration: Error Scenarios', () => {
  let tempDir;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'error-'));
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it('should handle corrupted prd.json gracefully', () => {
    const config = createConfig(tempDir, tempDir);
    ensureOutputDir(config.OUTPUT_DIR);

    // Write corrupted JSON
    fs.writeFileSync(config.PRD_FILE, '{ invalid json }}}');

    // hasPrdJson should return false for corrupted file
    expect(hasPrdJson(config.PRD_FILE)).toBe(false);
  });

  it('should handle empty prd.json', () => {
    const config = createConfig(tempDir, tempDir);
    ensureOutputDir(config.OUTPUT_DIR);

    // Write empty file
    fs.writeFileSync(config.PRD_FILE, '');

    // hasPrdJson should return false for empty file
    expect(hasPrdJson(config.PRD_FILE)).toBe(false);
  });

  it('should validate incomplete prd.json structure', () => {
    const incompletePrd = {
      project: 'Test',
      // Missing branchName, description, userStories
    };

    const validation = validatePrdJson(incompletePrd);

    expect(validation.valid).toBe(false);
    expect(validation.errors.length).toBeGreaterThan(0);
  });
});
