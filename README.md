# Gutenberg Release Monitor

A dashboard for tracking and visualizing [Gutenberg](https://github.com/WordPress/gutenberg) release statistics, including PR distribution, contributor trends, and WordPress version integration.

## Features

- **Release Statistics**: Track PRs by category (Features, Bugs, Accessibility, Performance, etc.)
- **WordPress Integration**: View Gutenberg releases grouped by WordPress version cycles
- **Contributor Insights**: Privacy-first sponsor and geographic breakdowns
- **Interactive Charts**: Multiple visualization types (stacked, area, line, bar)
- **Dark Mode**: System-aware theme with manual toggle

## Quick Start

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build
```

## Data Refresh

Update release data from GitHub:

```bash
# Parse changelogs and aggregate data
npm run refresh

# Compute contributor aggregates (privacy-first)
npm run compute-aggregates
```

See [Data Pipeline](docs/data-pipeline.md) for detailed workflow.

## Documentation

- [Architecture](docs/architecture.md) - System design and key patterns
- [Data Pipeline](docs/data-pipeline.md) - Scripts and data flow
- [Data Types](docs/data-types.md) - TypeScript interface reference

## Tech Stack

- **Frontend**: React 18 + TypeScript + Vite
- **UI**: @wordpress/components, @wordpress/dataviews
- **Charts**: Recharts, @automattic/charts
- **Data**: TanStack Query

## License

MIT
