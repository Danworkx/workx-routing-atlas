import { globSync } from 'glob'
import fs from 'fs'
import path from 'path'
import { parse } from '@babel/parser'
import * as t from '@babel/types'
import { RoleGuard } from './types'

// eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-var-requires
const _trav = require('@babel/traverse')
const traverse: typeof import('@babel/traverse').default = _trav.default ?? _trav

/** Quick-filter: does this file even mention a role? */
const ROLE_SIGNALS = ['role', 'roles', 'lmsRole', 'prismaRoles', 'orgType']
function hasRoleSignal(code: string): boolean {
  return ROLE_SIGNALS.some(s => code.includes(s))
}

/** Serialize an AST node to a readable string (best-effort). */
function nodeToStr(node: t.Node): string {
  if (t.isStringLiteral(node)) return `"${node.value}"`
  if (t.isNumericLiteral(node)) return String(node.value)
  if (t.isIdentifier(node)) return node.name
  if (t.isNullLiteral(node)) return 'null'
  if (t.isBooleanLiteral(node)) return String(node.value)
  if (t.isMemberExpression(node) && !node.computed) {
    return `${nodeToStr(node.object)}.${nodeToStr(node.property)}`
  }
  if (t.isBinaryExpression(node) || t.isLogicalExpression(node)) {
    return `${nodeToStr(node.left)} ${node.operator} ${nodeToStr(node.right)}`
  }
  if (t.isCallExpression(node)) {
    const args = (node.arguments as t.Node[]).slice(0, 2).map(nodeToStr).join(', ')
    return `${nodeToStr(node.callee)}(${args})`
  }
  if (t.isUnaryExpression(node)) return `${node.operator}${nodeToStr(node.argument)}`
  return '[complex]'
}

/** Extract redirect destination from a block of code using simple regex (post-parse fallback). */
function extractRedirectFromCode(code: string): string | undefined {
  const m =
    code.match(/router\.(push|replace)\(['"`]([^'"`]+)['"`]/) ??
    code.match(/redirect\(['"`]([^'"`]+)['"`]/) ??
    code.match(/NextResponse\.redirect\(.*?['"`]([^'"`]+)['"`]/)
  return m ? (m[2] ?? m[1]) : undefined
}

export interface CrawlGuardsResult {
  guards: RoleGuard[]
  errors: string[]
}

export function crawlGuards(repoName: string, repoPath: string): CrawlGuardsResult {
  const pattern = repoPath.replace(/\\/g, '/') + '/**/*.{ts,tsx}'
  const files = globSync(pattern, {
    ignore: ['**/node_modules/**', '**/.next/**'],
    absolute: true,
  }).filter(f => { const n = f.replace(/\\/g, '/'); return !n.includes('/node_modules/') && !n.includes('/.next/') })

  const guards: RoleGuard[] = []
  const errors: string[] = []

  for (const file of files) {
    const relFile = path.relative(repoPath, file).replace(/\\/g, '/')
    let code: string
    try {
      code = fs.readFileSync(file, 'utf-8')
    } catch { continue }

    if (!hasRoleSignal(code)) continue

    let ast: ReturnType<typeof parse>
    try {
      ast = parse(code, {
        sourceType: 'module',
        plugins: ['typescript', 'jsx'],
        errorRecovery: true,
      })
    } catch (e: unknown) {
      errors.push(`Parse error: ${relFile}: ${e instanceof Error ? e.message : String(e)}`)
      continue
    }

    try {
      traverse(ast, {
        // Catch if-statements whose test mentions role
        IfStatement(nodePath) {
          const testStr = nodeToStr(nodePath.node.test)
          if (!testStr.includes('role') && !testStr.includes('roles') && !testStr.includes('orgType')) return

          // Extract redirect from the consequent block using raw code slice
          let redirectTo: string | undefined
          const consq = nodePath.node.consequent
          if (consq.start != null && consq.end != null) {
            const blockCode = code.slice(consq.start, consq.end)
            redirectTo = extractRedirectFromCode(blockCode)
          }

          guards.push({
            repo: repoName,
            sourceFile: relFile,
            line: nodePath.node.loc?.start.line ?? 0,
            roleExpression: testStr,
            redirectTo,
            staticResolvable: !testStr.includes('[complex]'),
          })
        },

        // Also catch switch statements on role
        SwitchStatement(nodePath) {
          const discStr = nodeToStr(nodePath.node.discriminant)
          if (!discStr.includes('role') && !discStr.includes('roles') && !discStr.includes('orgType')) return

          guards.push({
            repo: repoName,
            sourceFile: relFile,
            line: nodePath.node.loc?.start.line ?? 0,
            roleExpression: `switch(${discStr})`,
            redirectTo: undefined,
            staticResolvable: !discStr.includes('[complex]'),
          })
        },
      })
    } catch (e: unknown) {
      errors.push(`Traverse error: ${relFile}: ${e instanceof Error ? e.message : String(e)}`)
    }
  }

  return { guards, errors }
}
