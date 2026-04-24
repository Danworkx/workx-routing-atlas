export interface Route {
  repo: string
  path: string    // URL path, e.g. /dashboard/:id
  file: string    // relative to repo root, e.g. src/app/dashboard/[id]/page.tsx
  type: 'page' | 'route' | 'layout'
}

export interface Link {
  repo: string
  sourceFile: string   // relative to repo root
  line: number
  destination: string  // raw value extracted from source (may contain ${…} for template literals)
  kind: 'href' | 'Link' | 'routerPush' | 'routerReplace' | 'redirect' | 'other'
}

export interface RoleGuard {
  repo: string
  sourceFile: string
  line: number
  roleExpression: string   // stringified test expression that mentions role
  redirectTo?: string      // redirect destination if statically determinable in the same block
  staticResolvable: boolean
}

export interface CrossAppLink {
  fromRepo: string
  toRepo: string
  sourceFile: string
  destination: string
}

export interface DeadLink {
  repo: string
  sourceFile: string
  line: number
  destination: string  // the internal path that has no matching route
}

export interface OrphanRoute {
  repo: string
  path: string  // the route path with no detected inbound link
}

export interface OptionBCandidate {
  repo: string
  sourceFile: string
  line: number
  destination: string  // /dashboard/admin/lms/... links in workx-app
}

export interface Atlas {
  generatedAt: string
  repos: Array<{
    name: string
    routeCount: number   // pages + api routes (not layouts)
    linkCount: number
    guardCount: number
  }>
  routes: Route[]
  links: Link[]
  guards: RoleGuard[]
  crossAppLinks: CrossAppLink[]
  deadInternalLinks: DeadLink[]
  orphanRoutes: OrphanRoute[]
  optionBCandidates: OptionBCandidate[]
}
