import { crawlRoutes } from './crawl-routes'
import { crawlLinks } from './crawl-links'
import { crawlGuards } from './crawl-guards'
import { REPOS } from './config'
import {
  Atlas,
  Route,
  Link,
  CrossAppLink,
  DeadLink,
  OrphanRoute,
  OptionBCandidate,
} from './types'

/** Links in workx-app matching this pattern are Option B candidates. */
const OPTION_B_RE = /^\/dashboard\/admin\/lms(\/|$)/

/** Strip query string and anchor; normalise trailing slash. */
function normaliseDest(dest: string): string {
  return dest.split('?')[0].split('#')[0].replace(/\/$/, '') || '/'
}

/**
 * Convert a route path (which may contain :param, :param*, :param?)
 * into a RegExp that matches concrete URLs.
 */
function routeToRegex(routePath: string): RegExp {
  const src = routePath
    // Escape regex metacharacters EXCEPT the colon segments we handle next
    .replace(/([.+^${}()|[\]\\])/g, '\\$1')
    // :param? → optional catch-all (zero or more chars)
    .replace(/:[\w]+\?/g, '[^/]*')
    // :param* → required catch-all (one or more chars)
    .replace(/:[\w]+\*/g, '.+')
    // :param → single segment
    .replace(/:[\w]+/g, '[^/]+')
  return new RegExp(`^${src}$`)
}

/** Returns true if routePath matches a normalised destination string. */
function routeMatchesDest(routePath: string, dest: string): boolean {
  const nd = normaliseDest(dest)
  if (routePath === nd) return true
  if (!routePath.includes(':')) return false
  return routeToRegex(routePath).test(nd)
}

/** Returns the target repo name if this is an external cross-app link, else null. */
function detectCrossAppTarget(
  dest: string,
  fromRepo: string,
  urlMap: Record<string, string[]>,
): string | null {
  if (!dest.startsWith('http')) return null
  for (const [repoName, urls] of Object.entries(urlMap)) {
    if (repoName === fromRepo) continue
    if (urls.some(u => dest.includes(u))) return repoName
  }
  return null
}

export interface BuildResult extends Atlas {
  errors: string[]
}

export function buildAtlas(): BuildResult {
  const allRoutes: Route[] = []
  const allLinks: Link[] = []
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const allGuards: any[] = []
  const allErrors: string[] = []

  const urlMap: Record<string, string[]> = {}
  for (const repo of REPOS) urlMap[repo.name] = repo.prodUrls

  // ── Crawl each repo ─────────────────────────────────────────────────────
  for (const repo of REPOS) {
    console.log(`[routes] ${repo.name} …`)
    allRoutes.push(...crawlRoutes(repo.name, repo.path, repo.appDir))

    console.log(`[links]  ${repo.name} …`)
    const { links, errors: le } = crawlLinks(repo.name, repo.path)
    allLinks.push(...links)
    allErrors.push(...le)

    console.log(`[guards] ${repo.name} …`)
    const { guards, errors: ge } = crawlGuards(repo.name, repo.path)
    allGuards.push(...guards)
    allErrors.push(...ge)
  }

  // ── Index routes by repo ─────────────────────────────────────────────────
  const routesByRepo: Record<string, Route[]> = {}
  for (const route of allRoutes) {
    ;(routesByRepo[route.repo] ??= []).push(route)
  }

  // ── Cross-app links ──────────────────────────────────────────────────────
  const crossAppLinks: CrossAppLink[] = []
  for (const link of allLinks) {
    const toRepo = detectCrossAppTarget(link.destination, link.repo, urlMap)
    if (toRepo) {
      crossAppLinks.push({
        fromRepo: link.repo,
        toRepo,
        sourceFile: link.sourceFile,
        destination: link.destination,
      })
    }
  }

  // ── Option B candidates ──────────────────────────────────────────────────
  const optionBCandidates: OptionBCandidate[] = []
  for (const link of allLinks) {
    if (link.repo === 'workx-app' && OPTION_B_RE.test(link.destination)) {
      optionBCandidates.push({
        repo: link.repo,
        sourceFile: link.sourceFile,
        line: link.line,
        destination: link.destination,
      })
    }
  }

  // ── Dead internal links ──────────────────────────────────────────────────
  const deadInternalLinks: DeadLink[] = []
  for (const link of allLinks) {
    const dest = link.destination
    if (!dest.startsWith('/')) continue          // external or relative — skip
    if (dest.includes('${')) continue            // dynamic — can't statically resolve
    if (dest.startsWith('//')) continue          // protocol-relative external

    const repoRoutes = routesByRepo[link.repo] ?? []
    if (!repoRoutes.some(r => routeMatchesDest(r.path, dest))) {
      deadInternalLinks.push({
        repo: link.repo,
        sourceFile: link.sourceFile,
        line: link.line,
        destination: dest,
      })
    }
  }

  // ── Orphan routes ────────────────────────────────────────────────────────
  const orphanRoutes: OrphanRoute[] = []
  const linksByRepo: Record<string, Link[]> = {}
  for (const link of allLinks) {
    ;(linksByRepo[link.repo] ??= []).push(link)
  }

  for (const route of allRoutes) {
    if (route.type === 'layout') continue   // layouts aren't navigated to directly
    if (route.path === '/') continue        // root always reachable via logo/home

    const repoLinks = linksByRepo[route.repo] ?? []
    const hasInbound = repoLinks.some(l => routeMatchesDest(route.path, l.destination))
    if (!hasInbound) {
      orphanRoutes.push({ repo: route.repo, path: route.path })
    }
  }

  // ── Summary ──────────────────────────────────────────────────────────────
  const repos = REPOS.map(r => ({
    name: r.name,
    routeCount: allRoutes.filter(x => x.repo === r.name && x.type !== 'layout').length,
    linkCount: allLinks.filter(x => x.repo === r.name).length,
    guardCount: allGuards.filter(x => x.repo === r.name).length,
  }))

  return {
    generatedAt: new Date().toISOString(),
    repos,
    routes: allRoutes,
    links: allLinks,
    guards: allGuards,
    crossAppLinks,
    deadInternalLinks,
    orphanRoutes,
    optionBCandidates,
    errors: allErrors,
  }
}
