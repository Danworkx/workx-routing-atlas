# workx-routing-atlas

Static crawler that maps every route, link, redirect, and role guard across the WorkX platform repos.

## What it produces

| Output | Description |
|---|---|
| `atlas.json` | Full structured data — routes, links, guards, cross-app links, dead links, orphan routes, Option B candidates |
| `atlas.md` | Human-readable summary tables for GitHub review |

## How to run

```bash
npm install
npm run crawl          # full run with ts-node
npm run crawl:fast     # skip type-checking (faster)
```

## Repos scanned

Configured in `src/config.ts`. Currently:

| Name | Path | App Dir |
|---|---|---|
| workx-app | `C:\Users\danad\workx-app` | `src/app` |
| workx-lms | `C:\Users\danad\OneDrive\Claude build\workx-lms` | `app` |

## What is crawled

- **Routes**: every `page.tsx`, `route.ts`, `layout.tsx` found under `appDir`, converted from filesystem path to URL path (route groups stripped, `[param]` → `:param`)
- **Links**: every `href`, `<Link>`, `router.push`, `router.replace`, `redirect()`, `NextResponse.redirect()` found in all `.ts/.tsx` files (static string and template literal values only)
- **Guards**: every `if` statement whose test expression mentions `role`, `roles`, or `session.user.role`, with the redirect destination if statically determinable

## Analysis fields in atlas.json

| Field | Meaning |
|---|---|
| `crossAppLinks` | Links that target the other repo's production URL |
| `deadInternalLinks` | Absolute internal links (`/foo/bar`) with no matching route in the same repo |
| `orphanRoutes` | Routes with no detected inbound link within the same repo |
| `optionBCandidates` | workx-app links to `/dashboard/admin/lms/...` — routes that may belong in workx-lms |

## How to extend

1. Add a new repo to `REPOS` in `src/config.ts`
2. Run `npm run crawl`

To add new link patterns (e.g., `useNavigation().navigate`), edit the `CallExpression` visitor in `src/crawl-links.ts`.

## Notes

- Uses CommonJS module format (not ESM/NodeNext) for compatibility with ts-node and @babel packages
- `atlas.json` and `atlas.md` are gitignored — regenerate locally or in CI
- Template literal destinations with dynamic segments are recorded as-is (e.g., `/dashboard/${id}`) and excluded from dead-link detection
