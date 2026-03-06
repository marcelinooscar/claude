# CLAUDE.md

This file provides guidance to AI assistants (Claude and others) working in this repository.

## Repository Overview

- **Owner**: marcelinooscar
- **Repository**: claude
- **Remote**: `http://local_proxy@127.0.0.1:51091/git/marcelinooscar/claude`
- **Status**: Newly initialized — no source files exist yet.

Update this section as the project evolves with a description of what the project does, its purpose, and its primary audience.

---

## Project Structure

_To be populated once files are added. Update this section to reflect the actual directory layout._

```
/
├── CLAUDE.md        # This file
└── ...              # Project files to be added
```

---

## Development Workflow

### Prerequisites

Document required tools, runtimes, and versions here (e.g., Node.js, Python, Go, Rust). Include installation instructions or links.

### Setup

```bash
# Clone the repository
git clone http://local_proxy@127.0.0.1:51091/git/marcelinooscar/claude
cd claude
```

Add dependency installation steps here (e.g., `npm install`, `pip install -r requirements.txt`).

### Running the Project

Document how to start the project locally (e.g., `npm run dev`, `python main.py`).

### Running Tests

Document the test command(s) here (e.g., `npm test`, `pytest`, `cargo test`).

### Building

Document the build command(s) here (e.g., `npm run build`, `make build`).

### Linting & Formatting

Document linting and formatting commands here (e.g., `npm run lint`, `black .`, `cargo fmt`).

---

## Git Conventions

### Branch Naming

- Feature branches: `feature/<short-description>`
- Bug fix branches: `fix/<short-description>`
- AI/Claude sessions: `claude/<session-id>` (automatically assigned by Claude Code)

> **Important for AI assistants**: Always develop on the branch specified at the start of your session. Never push to `main` or `master` directly without explicit user permission.

### Commit Messages

Write clear, imperative commit messages:

```
<type>: <short summary>

<optional body explaining why, not what>
```

Types: `feat`, `fix`, `docs`, `refactor`, `test`, `chore`

Examples:
- `feat: add user authentication endpoint`
- `fix: handle null pointer in payment processor`
- `docs: update CLAUDE.md with project structure`

### Pull Requests

- Keep PRs focused and small.
- Reference related issues in the PR description.
- Include a test plan describing how you validated the changes.

---

## Code Conventions

_To be filled in once a language/framework is chosen. Examples below are placeholders._

### Naming

- **Variables/Functions**: Follow the idiomatic conventions of the chosen language (e.g., `camelCase` for JS/TS, `snake_case` for Python/Rust).
- **Files**: Match the conventions of the chosen language and framework.
- **Constants**: `UPPER_SNAKE_CASE` (most languages).

### Style

- Prefer clarity over cleverness.
- Keep functions small and focused on a single responsibility.
- Avoid commented-out code — remove it or explain it.

### Error Handling

- Validate input at system boundaries (user input, external APIs, file I/O).
- Do not swallow errors silently — log or propagate them.
- Avoid over-engineering error paths for scenarios that cannot occur.

---

## AI Assistant Guidelines

### Do

- Read files before editing them.
- Make targeted, minimal changes — only what the task requires.
- Run tests after making changes when a test suite is available.
- Ask clarifying questions when requirements are ambiguous.
- Commit changes with descriptive messages and push to the designated branch.

### Do Not

- Push to `main`/`master` without explicit user approval.
- Add unnecessary abstractions, helpers, or utilities for one-off operations.
- Add comments or docstrings to code you didn't change.
- Introduce security vulnerabilities (SQL injection, XSS, command injection, etc.).
- Retry failing commands in a loop — investigate root causes instead.

### Preferred Patterns

- Prefer editing existing files over creating new ones.
- Prefer simple solutions over complex ones.
- Match the style and conventions already present in the codebase.

---

## Security

- Never commit secrets, credentials, API keys, or `.env` files.
- Validate all external input.
- Follow OWASP Top 10 best practices.
- If a security issue is found, note it clearly in the PR description.

---

## Contact & Resources

_Update with project-specific links, documentation URLs, and team contacts as they become available._
