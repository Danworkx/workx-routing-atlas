export interface RepoConfig {
  name: string
  path: string
  appDir: string        // relative to path, e.g. 'src/app' or 'app'
  prodUrls: string[]    // production hostnames for cross-app detection
}

export const REPOS: RepoConfig[] = [
  {
    name: 'workx-app',
    // Uses src/app/ layout (not app/ — confirmed by STEP 1 recon)
    path: 'C:\\Users\\danad\\workx-app',
    appDir: 'src/app',
    prodUrls: ['workx-platform-gamma.vercel.app', 'app.workx.co.nz'],
  },
  {
    name: 'workx-lms',
    path: 'C:\\Users\\danad\\OneDrive\\Claude build\\workx-lms',
    appDir: 'app',
    prodUrls: ['workx-lms.vercel.app'],
  },
]
