import { Atlas } from './types'

/** Build a GitHub-flavoured markdown table. Returns `_None._` if rows is empty. */
function mdTable(headers: string[], rows: string[][]): string {
  if (rows.length === 0) return '_None._\n'
  const sep = headers.map(() => '---')
  return [
    '| ' + headers.join(' | ') + ' |',
    '| ' + sep.join(' | ') + ' |',
    ...rows.map(r => '| ' + r.map(c => c.replace(/\|/g, '\\|')).join(' | ') + ' |'),
  ].join('\n') + '\n'
}

function escMd(s: string): string {
  return s.replace(/[`|]/g, c => `\\${c}`)
}

export function renderMarkdown(atlas: Atlas): string {
  const out: string[] = []

  out.push('# WorkX Routing Atlas\n')
  out.push(`_Generated: ${atlas.generatedAt}_\n`)

  // ── 1. Summary ────────────────────────────────────────────────────────────
  out.push('## 1. Summary\n')
  out.push(mdTable(
    ['Repo', 'Navigable Routes', 'Links Extracted', 'Role Guards'],
    atlas.repos.map(r => [r.name, String(r.routeCount), String(r.linkCount), String(r.guardCount)]),
  ))
  out.push([
    `- **Cross-app links:** ${atlas.crossAppLinks.length}`,
    `- **Dead internal links:** ${atlas.deadInternalLinks.length}`,
    `- **Orphan routes:** ${atlas.orphanRoutes.length}`,
    `- **Option B candidates:** ${atlas.optionBCandidates.length}`,
  ].join('\n') + '\n')

  // ── 2. Cross-app links ────────────────────────────────────────────────────
  out.push('## 2. Cross-App Links\n')
  out.push('_Links that cross the workx-app ↔ workx-lms boundary (detected via production hostname)._\n')
  out.push(mdTable(
    ['From Repo', 'To Repo', 'Source File', 'Destination'],
    atlas.crossAppLinks.map(l => [l.fromRepo, l.toRepo, escMd(l.sourceFile), escMd(l.destination)]),
  ))

  // ── 3. Dead internal links ────────────────────────────────────────────────
  out.push('## 3. Dead Internal Links\n')
  out.push('_Absolute internal links (`/path`) with no matching route in the same repo._\n')
  out.push(mdTable(
    ['Repo', 'Source File', 'Line', 'Dead Destination'],
    atlas.deadInternalLinks.map(l => [l.repo, escMd(l.sourceFile), String(l.line), escMd(l.destination)]),
  ))

  // ── 4. Option B candidates ────────────────────────────────────────────────
  out.push('## 4. Option B Candidates\n')
  out.push('_Links in **workx-app** pointing to `/dashboard/admin/lms/…` — these routes may belong in workx-lms._\n')
  out.push(mdTable(
    ['Source File', 'Line', 'Destination'],
    atlas.optionBCandidates.map(c => [escMd(c.sourceFile), String(c.line), escMd(c.destination)]),
  ))

  // ── 5. Orphan routes ─────────────────────────────────────────────────────
  out.push('## 5. Orphan Routes\n')
  out.push('_Routes that exist on disk but have no detected inbound link within the same repo._\n')
  out.push(mdTable(
    ['Repo', 'Route Path'],
    atlas.orphanRoutes.map(r => [r.repo, escMd(r.path)]),
  ))

  // ── 6. Full route list (collapsible) ──────────────────────────────────────
  out.push('## 6. Full Route List\n')
  for (const repo of atlas.repos) {
    const rows = atlas.routes.filter(r => r.repo === repo.name)
    out.push('<details>')
    out.push(`<summary><strong>${repo.name}</strong> — ${rows.length} files (${repo.routeCount} navigable routes)</summary>\n`)
    out.push(mdTable(
      ['Route Path', 'Type', 'File'],
      rows.map(r => [escMd(r.path), r.type, escMd(r.file)]),
    ))
    out.push('</details>\n')
  }

  // ── 7. Full link list (collapsible) ───────────────────────────────────────
  out.push('## 7. Full Link List\n')
  for (const repo of atlas.repos) {
    const rows = atlas.links.filter(l => l.repo === repo.name)
    out.push('<details>')
    out.push(`<summary><strong>${repo.name}</strong> — ${rows.length} links</summary>\n`)
    out.push(mdTable(
      ['Source File', 'Line', 'Destination', 'Kind'],
      rows.map(l => [escMd(l.sourceFile), String(l.line), escMd(l.destination), l.kind]),
    ))
    out.push('</details>\n')
  }

  return out.join('\n')
}
