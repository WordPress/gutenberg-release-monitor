# Gutenberg Release Monitor

A dashboard for visualizing release statistics. Built for [WordPress Gutenberg](https://github.com/WordPress/gutenberg), but the frontend is generic as it just renders JSON. You can swap in your own data scripts to track any project.

**[View the live dashboard →](https://WordPress.github.io/gutenberg-release-monitor)**

## What it does

- Track PRs by category (features, bugs, accessibility, performance, etc.)
- Group releases by parent version (e.g., which Gutenberg releases ship in WordPress 6.8)
- See contributor breakdowns by sponsor and country (privacy-first: only aggregates, no individual data stored)
- Interactive charts with multiple visualization options
- Shareable URLs that preserve your selections
- Dark mode

## Quick Start

```bash
npm install
npm run dev
```

Open <http://localhost:5173>

## How it works

The dashboard reads JSON files from `public/data/`. The included scripts fetch data from GitHub, but you could generate these files however you want.

```text
public/
├── config/
│   ├── project.json      # Tabs, labels, defaults
│   └── categories.json   # Category colors and groupings
└── data/
    ├── gb-releases.json  # Individual releases
    ├── wp-cycles.json    # Grouped by WP version
    └── summary.json      # Overall stats
```

### Refreshing data

```bash
npm run data-sync:all              # Fetch releases + compute aggregates
npm run data-sync:contributor-stats # Add sponsor/country breakdowns (slow)
```

Data refreshes automatically every Thursday via GitHub Actions.

## Using this for another project

1. Edit `public/config/project.json` to change tabs and labels
2. Edit `public/config/categories.json` to define your category groupings
3. Generate JSON files matching the schema in [Data Types](docs/data-types.md)
4. Optionally modify or replace the scripts in `scripts/`

See [Configuration Guide](docs/configuration.md) for details.

## Documentation

| Doc                                    | What's in it                       |
| -------------------------------------- | ---------------------------------- |
| [Architecture](docs/architecture.md)   | How the pieces fit together        |
| [Configuration](docs/configuration.md) | Customizing the dashboard          |
| [Data Pipeline](docs/data-pipeline.md) | How data flows from GitHub to JSON |
| [Data Types](docs/data-types.md)       | TypeScript interfaces              |
| [API Reference](docs/api-reference.md) | Hooks and utility functions        |
| [Contributing](docs/contributing.md)   | Dev setup and PR guidelines        |
| [Deployment](docs/deployment.md)       | CI/CD and GitHub Pages             |

## Tech stack

React 18, TypeScript, Vite, TanStack Query, Recharts, @wordpress/components. Tests with Vitest and Playwright. Hosted on GitHub Pages.

## License

MIT
