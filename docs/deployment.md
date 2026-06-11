# Deployment Guide

This guide covers the CI/CD pipelines, deployment process, and data refresh automation.

## Overview

The project uses GitHub Actions for:

- **Continuous Integration**: Lint, type check, and test on every push/PR
- **Deployment**: Automatic deployment to GitHub Pages on pushes to `trunk` and after successful data refresh runs
- **Data Refresh**: Weekly automated data updates

## CI/CD Pipeline

### Workflow: deploy.yml

**Triggers**:

- Push to `trunk`
- Manual `workflow_dispatch`
- Successful completion of `Refresh Release Data` on `trunk`

**Pipeline Structure**:

```text
                    ┌─────────────┐
                    │    Lint     │
                    └──────┬──────┘
                           │
           ┌───────────────┼───────────────┐
           ▼               ▼               ▼
    ┌─────────────┐ ┌─────────────┐ ┌─────────────┐
    │ Unit Tests  │ │  E2E Tests  │ │  Type Check │
    └──────┬──────┘ └──────┬──────┘ └──────┬──────┘
           │               │               │
           └───────────────┼───────────────┘
                           ▼
                    ┌─────────────┐
                    │    Build    │
                    └──────┬──────┘
                           ▼
                    ┌─────────────┐
                    │   Deploy    │
                    └─────────────┘
```

### Jobs

#### 1. Lint

Runs ESLint to check code quality:

```yaml
- uses: actions/checkout@v4
- uses: actions/setup-node@v4
  with:
    node-version: '20'
    cache: 'npm'
- run: npm ci
- run: npm run lint
```

#### 2. Unit Tests

Runs Vitest unit tests:

```yaml
- run: npm ci
- run: npm test
```

#### 3. E2E Tests

Runs Playwright E2E tests:

```yaml
- run: npm ci
- run: npx playwright install --with-deps
- run: npm run build
- run: npm run test:e2e
```

**Artifacts**: Test results uploaded on failure for debugging.

#### 4. Build

Creates production build:

```yaml
- run: npm ci
- run: npm run build
```

**Output**: `dist/` directory uploaded as artifact.

#### 5. Deploy

Deploys to GitHub Pages:

```yaml
- uses: actions/deploy-pages@v4
```

**Requirements**: GitHub Pages must be configured to deploy from GitHub Actions.

## Data Refresh Pipeline

### Workflow: refresh-data.yml

**Triggers**:

- **Scheduled**: Every Thursday at 9:00 UTC
- **Manual**: Via workflow_dispatch with options

### Manual Trigger Options

| Input | Options | Description |
|-------|---------|-------------|
| `from_version` | free text | Optional lower bound version |
| `to_version` | free text | Optional upper bound version |
| `contributor_aggregates` | `auto`, `skip`, `force-all` | Contributor data mode |

### Contributor Aggregate Modes

- **auto**: Process only releases without existing aggregates
- **skip**: Skip contributor processing entirely
- **force-all**: Reprocess all releases (slow, use sparingly)

### Pipeline Steps

```yaml
jobs:
  refresh:
    steps:
      - checkout
      - setup-node
      - npm ci
      - npm run data-sync:gb-releases
      - npm run data-sync:wp-cycles
      - npm run data-sync:contributor-stats  # conditional
      - git commit and push changes
      - deploy.yml runs via workflow_run after a successful refresh
```

### Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `GITHUB_TOKEN` | Yes | Auto-provided by Actions, used for GitHub API |

## GitHub Pages Setup

### Initial Configuration

1. Go to repository **Settings** > **Pages**

2. Under **Source**, select **GitHub Actions**

3. The `deploy.yml` workflow handles deployment automatically for `trunk` pushes and successful scheduled refreshes

### Custom Domain (Optional)

1. Add a `CNAME` file to `public/` with your domain

2. Configure DNS to point to GitHub Pages

3. Enable HTTPS in repository settings

## Local Development

### Running the Full Pipeline

```bash
# Lint
npm run lint

# Type check
npm run typecheck

# Unit tests
npm test

# Build for E2E
npm run build

# E2E tests
npm run test:e2e

# Full pipeline equivalent
npm run lint && npm run typecheck && npm test && npm run build && npm run test:e2e
```

### Local Data Refresh

```bash
# Requires GITHUB_TOKEN for higher rate limits
export GITHUB_TOKEN=your_token

# Full data refresh
npm run data-sync:all

# With contributor stats (slow)
npm run data-sync:contributor-stats
```

## Monitoring

### Deployment Status

Check deployment status:

1. Go to repository **Actions** tab
2. Select **Deploy** workflow
3. View latest run status and logs

### Data Freshness

Check when data was last updated:

1. View `public/data/summary.json`
2. Check `lastUpdated` field
3. Or check the refresh-data workflow history

### Common Issues

#### Build Failures

| Issue | Solution |
|-------|----------|
| Lint errors | Run `npm run lint` locally, fix issues |
| Type errors | Run `npm run typecheck` locally |
| Test failures | Run `npm test` or `npm run test:e2e` locally |

#### Deployment Failures

| Issue | Solution |
|-------|----------|
| Pages not configured | Enable GitHub Pages in repository settings |
| Permission denied | Check repository permissions for Actions |

#### Data Refresh Failures

| Issue | Solution |
|-------|----------|
| Rate limit exceeded | Ensure GITHUB_TOKEN is configured |
| API errors | Check GitHub API status, retry later |
| Parse errors | Check for changelog format changes |

## Security Considerations

### Secrets Management

- `GITHUB_TOKEN` is automatically provided by GitHub Actions
- Never commit tokens or secrets to the repository
- Use repository secrets for additional credentials

### Branch Protection

Recommended settings for `trunk`:

- Require status checks to pass
- Require branches to be up to date
- Include: lint, unit-tests, e2e-tests, typecheck

## Customization

### Adding Pipeline Steps

To add a new check to the pipeline:

1. Add job to `.github/workflows/deploy.yml`
2. Add to `needs` array of downstream jobs
3. Test with a pull request before merging

### Modifying Refresh Schedule

Edit the cron expression in `refresh-data.yml`:

```yaml
schedule:
  - cron: '0 9 * * 4'  # Thursday 9:00 UTC
```

Cron format: `minute hour day-of-month month day-of-week`

### Adding Data Sources

To add a new data source to the refresh pipeline:

1. Create script in `scripts/`
2. Add npm script to `package.json`
3. Add step to `refresh-data.yml`
4. Update documentation
