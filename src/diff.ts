import { Atlas, DeadLink, OptionBCandidate } from './types'

export interface DiffResult {
  newDeadLinks: DeadLink[]
  newOptionBCandidates: OptionBCandidate[]
}

/** Returns entries present in `current` but absent from `baseline`, filtered to `repo`. */
export function diffAtlas(baseline: Atlas, current: Atlas, repo: string): DiffResult {
  const baselineDead = new Set(
    baseline.deadInternalLinks
      .filter(l => l.repo === repo)
      .map(l => `${l.sourceFile}::${l.destination}::${l.line}`),
  )

  const newDeadLinks = current.deadInternalLinks
    .filter(l => l.repo === repo)
    .filter(l => !baselineDead.has(`${l.sourceFile}::${l.destination}::${l.line}`))

  // Option B: match on sourceFile + destination only (line can shift on edits)
  const baselineOptB = new Set(
    baseline.optionBCandidates
      .filter(c => c.repo === repo)
      .map(c => `${c.sourceFile}::${c.destination}`),
  )

  const newOptionBCandidates = current.optionBCandidates
    .filter(c => c.repo === repo)
    .filter(c => !baselineOptB.has(`${c.sourceFile}::${c.destination}`))

  return { newDeadLinks, newOptionBCandidates }
}
