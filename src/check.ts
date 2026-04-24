import fs from 'fs'
import path from 'path'
import { buildAtlas } from './build-atlas'
import { diffAtlas } from './diff'
import { Atlas } from './types'

const repoName = process.argv[2]
if (!repoName) {
  console.error('Usage: ts-node src/check.ts <repo-name>')
  console.error('  repo-name: workx-app | workx-lms')
  process.exit(1)
}

const baselinePath = path.join(__dirname, '..', 'atlas.json')
if (!fs.existsSync(baselinePath)) {
  console.error(`No baseline atlas.json found at ${baselinePath}`)
  console.error('Run "npm run crawl" from the atlas repo first to generate a baseline.')
  process.exit(1)
}

const baseline: Atlas = JSON.parse(fs.readFileSync(baselinePath, 'utf-8'))

console.log(`[atlas] checking ${repoName}…`)
const { errors, ...current } = buildAtlas(repoName)

if (errors.length > 0) {
  console.warn(`[atlas] ${errors.length} parse error(s) during scan (non-blocking):`)
  errors.slice(0, 5).forEach(e => console.warn('  !', e))
}

const { newDeadLinks, newOptionBCandidates } = diffAtlas(baseline, current, repoName)

if (newDeadLinks.length === 0 && newOptionBCandidates.length === 0) {
  console.log('✓ atlas check passed')
  process.exit(0)
}

console.error('\n✗ atlas check FAILED — this commit introduces routing regressions:\n')

if (newDeadLinks.length > 0) {
  console.error(`  NEW DEAD LINKS (${newDeadLinks.length}):`)
  for (const l of newDeadLinks) {
    console.error(`    ${l.sourceFile}:${l.line} → "${l.destination}"`)
  }
}

if (newOptionBCandidates.length > 0) {
  console.error(`\n  NEW OPTION B CANDIDATES (${newOptionBCandidates.length}):`)
  console.error('  (workx-app links into /dashboard/admin/lms — should these live in workx-lms?)')
  for (const c of newOptionBCandidates) {
    console.error(`    ${c.sourceFile}:${c.line} → "${c.destination}"`)
  }
}

console.error('\n  Fix the links above, or use git commit --no-verify to bypass (emergencies only).\n')
process.exit(1)
