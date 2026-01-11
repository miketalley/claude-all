---
name: ralph
description: "Convert PRDs to prd.json format for the Ralph autonomous agent system. Use when you have an existing PRD and need to convert it to Ralph's JSON format. Triggers on: convert this prd, turn this into ralph format, create prd.json from this, ralph json."
---

# Ralph PRD Converter

Convert Product Requirements Documents into the `prd.json` format used by the Ralph autonomous agent system.

---

## The Job

1. Receive a PRD description (either from $1 file path or inline text)
2. If given a file path, read the file first
3. Parse the PRD to extract user stories and project information
4. Generate a properly formatted `prd.json` file
5. Save to `prd.json` in the current directory

**Important:** Do NOT implement any code. Just create the prd.json file.

---

## prd.json Format

The output must be valid JSON with this structure:

```json
{
  "project": "Project Name",
  "branchName": "ralph/feature-name",
  "description": "Brief description of the project/feature",
  "userStories": [
    {
      "id": "US-001",
      "title": "Short title",
      "description": "As a [user], I want [feature] so that [benefit].",
      "acceptanceCriteria": [
        "Criterion 1",
        "Criterion 2",
        "Typecheck passes"
      ],
      "priority": 1,
      "passes": false,
      "notes": ""
    }
  ]
}
```

---

## Field Definitions

### Project Level
- **project**: Human-readable project name
- **branchName**: Git branch name, always prefixed with `ralph/` (kebab-case)
- **description**: 1-2 sentence summary of the project/feature

### User Story Level
- **id**: Sequential identifier (US-001, US-002, etc.)
- **title**: Short, action-oriented title (5-10 words)
- **description**: Full user story in "As a... I want... so that..." format
- **acceptanceCriteria**: Array of specific, verifiable criteria
- **priority**: Sequential number (1 = first to implement)
- **passes**: Always `false` initially (Ralph will update when complete)
- **notes**: Empty string initially (Ralph adds implementation notes)

---

## Story Ordering Guidelines

Order user stories by dependency and logical progression:

1. **Infrastructure first** - Database schemas, project setup, configuration
2. **Core backend** - APIs, services, business logic
3. **Basic frontend** - Essential UI components, layouts
4. **Features** - User-facing functionality
5. **Enhancements** - Polish, advanced features, optimizations

Each story should be completable in one focused session (roughly 15-45 minutes of AI work).

---

## Acceptance Criteria Best Practices

- Be specific and verifiable (not "works correctly")
- Include "Typecheck passes" for code changes
- Include "Verify in browser using dev-browser skill" for UI changes
- Include "Migration runs successfully" for database changes
- Each criterion should be checkable as pass/fail

### Good Examples
- "Add `status` column to users table with values: 'active' | 'inactive'"
- "Login button disabled while request is pending"
- "Error message displayed below form field on validation failure"

### Bad Examples
- "Works correctly"
- "Good user experience"
- "Handles edge cases"

---

## Branch Naming

Generate branch name from project/feature name:
- Prefix: `ralph/`
- Format: kebab-case
- Examples:
  - "Task Priority System" → `ralph/task-priority-system`
  - "User Authentication" → `ralph/user-authentication`
  - "Dashboard Analytics" → `ralph/dashboard-analytics`

---

## Example Output

Input: "Build a simple todo app with add/delete/complete functionality"

Output (prd.json):
```json
{
  "project": "Simple Todo App",
  "branchName": "ralph/simple-todo-app",
  "description": "A basic todo application with the ability to add, delete, and mark tasks as complete.",
  "userStories": [
    {
      "id": "US-001",
      "title": "Initialize project structure",
      "description": "As a developer, I need a properly configured project so that development can proceed.",
      "acceptanceCriteria": [
        "Project initialized with package.json",
        "Basic folder structure created",
        "Typecheck passes"
      ],
      "priority": 1,
      "passes": false,
      "notes": ""
    },
    {
      "id": "US-002",
      "title": "Create Todo data model",
      "description": "As a developer, I need a Todo data structure to store task information.",
      "acceptanceCriteria": [
        "Todo type with id, text, and completed fields",
        "Typecheck passes"
      ],
      "priority": 2,
      "passes": false,
      "notes": ""
    },
    {
      "id": "US-003",
      "title": "Display todo list",
      "description": "As a user, I want to see my todos displayed so I can track what needs to be done.",
      "acceptanceCriteria": [
        "Todos render in a list format",
        "Each todo shows its text",
        "Empty state shown when no todos exist",
        "Typecheck passes",
        "Verify in browser using dev-browser skill"
      ],
      "priority": 3,
      "passes": false,
      "notes": ""
    },
    {
      "id": "US-004",
      "title": "Add new todo",
      "description": "As a user, I want to add new todos so I can track new tasks.",
      "acceptanceCriteria": [
        "Input field for todo text",
        "Add button or Enter key to submit",
        "New todo appears in list immediately",
        "Input clears after adding",
        "Typecheck passes",
        "Verify in browser using dev-browser skill"
      ],
      "priority": 4,
      "passes": false,
      "notes": ""
    },
    {
      "id": "US-005",
      "title": "Mark todo as complete",
      "description": "As a user, I want to mark todos as complete so I can track my progress.",
      "acceptanceCriteria": [
        "Checkbox or click to toggle complete status",
        "Completed todos visually distinct (strikethrough or dimmed)",
        "Typecheck passes",
        "Verify in browser using dev-browser skill"
      ],
      "priority": 5,
      "passes": false,
      "notes": ""
    },
    {
      "id": "US-006",
      "title": "Delete todo",
      "description": "As a user, I want to delete todos so I can remove items I no longer need.",
      "acceptanceCriteria": [
        "Delete button on each todo",
        "Todo removed from list immediately on delete",
        "Typecheck passes",
        "Verify in browser using dev-browser skill"
      ],
      "priority": 6,
      "passes": false,
      "notes": ""
    }
  ]
}
```

---

## Checklist

Before saving prd.json:

- [ ] Valid JSON syntax
- [ ] branchName starts with `ralph/`
- [ ] Stories ordered by dependency (infrastructure → backend → frontend)
- [ ] Each story has specific, verifiable acceptance criteria
- [ ] All stories have `passes: false` and empty `notes`
- [ ] Priority numbers are sequential (1, 2, 3...)
- [ ] IDs are sequential (US-001, US-002, US-003...)
- [ ] Saved to `prd.json` in current directory
