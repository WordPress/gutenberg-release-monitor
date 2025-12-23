# Contributing Guide

Thank you for your interest in contributing to Gutenberg Release Monitor!

## Getting Started

### Prerequisites

- Node.js 20 or later
- npm 9 or later
- Git

### Setup

1. Fork the repository on GitHub

2. Clone your fork:

```bash
git clone https://github.com/YOUR_USERNAME/gutenberg-release-monitor.git
cd gutenberg-release-monitor
```

3. Install dependencies:

```bash
npm install
```

4. Start the development server:

```bash
npm run dev
```

The app will be available at `http://localhost:5173`

## Development Workflow

### Branch Naming

Create descriptive branch names:

- `feature/add-new-chart-type`
- `fix/url-state-sync-issue`
- `docs/update-api-reference`
- `refactor/category-utilities`

### Code Style

This project uses:

- **TypeScript** with strict mode enabled
- **ESLint** for linting
- **Prettier** formatting (via ESLint)

Run linting before committing:

```bash
npm run lint
npm run typecheck
```

### Making Changes

1. Create a feature branch from `trunk`:

```bash
git checkout trunk
git pull origin trunk
git checkout -b feature/your-feature
```

2. Make your changes

3. Run tests:

```bash
npm test           # Unit tests
npm run test:e2e   # E2E tests (requires built app)
```

4. Commit with a descriptive message:

```bash
git commit -m "Add support for custom chart colors"
```

5. Push and create a pull request

## Testing

### Unit Tests (Vitest)

Unit tests cover data processing scripts and utilities.

```bash
# Run all unit tests
npm test

# Watch mode for development
npm run test:watch

# With coverage report
npm run test:coverage
```

**Test locations**:

- `tests/unit/scripts/` - Script tests (changelog parser, category utils, etc.)
- `tests/unit/src/` - React component and hook tests

### E2E Tests (Playwright)

E2E tests verify user interactions and UI behavior.

```bash
# Run E2E tests headless
npm run test:e2e

# Run with interactive UI
npm run test:e2e:ui
```

**Test locations**:

- `tests/e2e/*.spec.ts` - Test files
- `tests/e2e/public/` - Test fixtures (mock data)

**Writing E2E tests**:

Tests use mock data from `tests/e2e/public/` when running with `VITE_TEST_MODE=true`.

```typescript
import { test, expect } from '@playwright/test';

test('should switch tabs', async ({ page }) => {
  await page.goto('/');
  await page.click('button:has-text("By GB Release")');
  await expect(page.locator('h2')).toContainText('Gutenberg');
});
```

### Test Fixtures

Shared test data is in `tests/fixtures/`:

- `changelog-samples.ts` - Sample changelog formats for parser tests

## Code Organization

### Frontend (`src/`)

```text
src/
├── App.tsx              # Main component
├── config/              # Configuration system
│   ├── ConfigProvider.tsx
│   └── types.ts
├── components/          # React components
├── hooks/               # Custom React hooks
├── data/                # TypeScript types
└── utils/               # Utility functions
```

### Scripts (`scripts/`)

```text
scripts/
├── build-gb-releases.ts      # Parse GitHub releases
├── build-wp-cycles.ts        # Aggregate by WP version
├── compute-contributor-stats.ts  # Contributor aggregates
└── utils/                    # Script utilities
```

### Where to Add New Features

| Feature Type | Location |
|--------------|----------|
| New chart type | `src/components/TrendChart.tsx` |
| New view mode | `src/components/SummaryStats.tsx` + `TrendChart.tsx` |
| New URL parameter | `src/App.tsx` + `useURLState` hook |
| New data source | `scripts/` + `public/config/project.json` |
| New category | `public/config/categories.json` |

## Pull Request Process

### Before Submitting

1. Ensure all tests pass:

```bash
npm test
npm run test:e2e
npm run lint
npm run typecheck
```

2. Update documentation if needed

3. Add tests for new features

### PR Guidelines

- **Title**: Clear, concise description of the change
- **Description**: Explain what and why, not how
- **Size**: Keep PRs focused; split large changes

### CI Requirements

All PRs must pass:

- Lint check (`npm run lint`)
- Type check (`npm run typecheck`)
- Unit tests (`npm test`)
- E2E tests (`npm run test:e2e`)

## Reporting Issues

### Bug Reports

Include:

- Steps to reproduce
- Expected behavior
- Actual behavior
- Browser/OS information
- Screenshots if applicable

### Feature Requests

Include:

- Use case description
- Proposed solution
- Alternatives considered

## Project Structure

See [Architecture](architecture.md) for detailed system design.

## Questions?

Feel free to open an issue for questions or discussion.
