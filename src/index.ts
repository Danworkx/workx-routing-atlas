import fs from 'fs'
import path from 'path'
import { buildAtlas } from './build-atlas'
import { renderMarkdown } from './render-markdown'

function main() {
  const start = Date.now()
  console.log('WorkX Routing Atlas — building…\n')

  const { errors, ...atlas } = buildAtlas()

  const elapsed = ((Date.now() - start) / 1000).toFixed(1)

  console.log('\n──────────────────────────────────────')
  console.log(`Completed in ${elapsed}s`)
  console.log(`  Routes:              ${atlas.routes.length}`)
  console.log(`  Links:               ${atlas.links.length}`)
  console.log(`  Guards:              ${atlas.guards.length}`)
  console.log(`  Cross-app links:     ${atlas.crossAppLinks.length}`)
  console.log(`  Dead internal links: ${atlas.deadInternalLinks.length}`)
  console.log(`  Orphan routes:       ${atlas.orphanRoutes.length}`)
  console.log(`  Option B candidates: ${atlas.optionBCandidates.length}`)

  if (errors.length > 0) {
    console.log(`\nParse / traverse errors: ${errors.length}`)
    const sample = errors.slice(0, 15)
    sample.forEach(e => console.log('  ✗', e))
    if (errors.length > 15) console.log(`  … and ${errors.length - 15} more`)
  }

  const root = path.join(__dirname, '..')

  // atlas.json
  const jsonPath = path.join(root, 'atlas.json')
  fs.writeFileSync(jsonPath, JSON.stringify(atlas, null, 2), 'utf-8')
  console.log(`\nWrote ${jsonPath}`)

  // atlas.md
  const mdPath = path.join(root, 'atlas.md')
  const md = renderMarkdown(atlas)
  fs.writeFileSync(mdPath, md, 'utf-8')
  console.log(`Wrote ${mdPath}`)
}

main()
