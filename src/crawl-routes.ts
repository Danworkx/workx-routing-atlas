import { globSync } from 'glob'
import path from 'path'
import { Route } from './types'

/**
 * Converts a single path segment to its route equivalent.
 * Returns null for route-group segments (stripped from URL).
 */
function segmentToRoute(seg: string): string | null {
  // (group) → strip entirely
  if (/^\(.*\)$/.test(seg)) return null
  // [[...param]] → :param? (optional catch-all)
  const optCatchAll = seg.match(/^\[\[\.\.\.(.+?)\]\]$/)
  if (optCatchAll) return `:${optCatchAll[1]}?`
  // [...param] → :param* (required catch-all)
  const catchAll = seg.match(/^\[\.\.\.(.+?)\]$/)
  if (catchAll) return `:${catchAll[1]}*`
  // [param] → :param (dynamic segment)
  const dynamic = seg.match(/^\[(.+?)\]$/)
  if (dynamic) return `:${dynamic[1]}`
  // @parallel and _private folders — keep as-is (rare in this codebase)
  return seg
}

/**
 * Given an absolute path to a page/route/layout file and the absolute appDir,
 * returns the corresponding URL path.
 */
function fileToRoutePath(filePath: string, fullAppDir: string): string {
  const rel = path.relative(fullAppDir, filePath).replace(/\\/g, '/')
  const parts = rel.split('/')
  // Drop the filename (last segment)
  const dirParts = parts.slice(0, -1)

  const routeSegments = dirParts
    .map(segmentToRoute)
    .filter((s): s is string => s !== null)

  return routeSegments.length === 0 ? '/' : '/' + routeSegments.join('/')
}

export function crawlRoutes(repoName: string, repoPath: string, appDir: string): Route[] {
  const fullAppDir = path.join(repoPath, appDir)
  // glob needs forward slashes even on Windows
  const pattern = fullAppDir.replace(/\\/g, '/') + '/**/{page,route,layout}.{tsx,ts,jsx,js}'

  const files = globSync(pattern, {
    ignore: ['**/node_modules/**', '**/.next/**'],
    absolute: true,
  })

  const routes: Route[] = []

  for (const file of files) {
    const filename = path.basename(file)
    let type: Route['type']
    if (filename.startsWith('page')) type = 'page'
    else if (filename.startsWith('layout')) type = 'layout'
    else if (filename.startsWith('route')) type = 'route'
    else continue

    const routePath = fileToRoutePath(file, fullAppDir)
    const relFile = path.relative(repoPath, file).replace(/\\/g, '/')

    routes.push({ repo: repoName, path: routePath, file: relFile, type })
  }

  // Sort by path for readability
  return routes.sort((a, b) => a.path.localeCompare(b.path))
}
