import { globSync } from 'glob'
import fs from 'fs'
import path from 'path'
import { parse } from '@babel/parser'
import * as t from '@babel/types'
import { Link } from './types'

// @babel/traverse ships a default export but CJS interop requires fallback
// eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-var-requires
const _trav = require('@babel/traverse')
const traverse: typeof import('@babel/traverse').default = _trav.default ?? _trav

/** Flatten a template literal to its best static representation. */
function templateToString(node: t.TemplateLiteral): string {
  const parts: string[] = []
  for (let i = 0; i < node.quasis.length; i++) {
    parts.push(node.quasis[i].value.cooked ?? node.quasis[i].value.raw)
    if (i < node.expressions.length) parts.push('${…}')
  }
  return parts.join('')
}

/** Extract a string destination from a node, or null if not statically determinable. */
function extractString(node: t.Node | null | undefined): string | null {
  if (!node) return null
  if (t.isStringLiteral(node)) return node.value
  if (t.isTemplateLiteral(node)) return templateToString(node)
  return null
}

/** True if the expression looks like a router object (`router`, `Router`). */
function isRouterExpr(node: t.Expression): boolean {
  return t.isIdentifier(node) && (node.name === 'router' || node.name === 'Router')
}

function parseFile(filePath: string): ReturnType<typeof parse> | null {
  let code: string
  try {
    code = fs.readFileSync(filePath, 'utf-8')
  } catch {
    return null
  }
  try {
    return parse(code, {
      sourceType: 'module',
      plugins: ['typescript', 'jsx'],
      errorRecovery: true,
    })
  } catch {
    // Retry without jsx for plain .ts files
    try {
      return parse(code, {
        sourceType: 'module',
        plugins: ['typescript'],
        errorRecovery: true,
      })
    } catch {
      return null
    }
  }
}

export interface CrawlLinksResult {
  links: Link[]
  errors: string[]
}

export function crawlLinks(repoName: string, repoPath: string): CrawlLinksResult {
  const pattern = repoPath.replace(/\\/g, '/') + '/**/*.{ts,tsx,js,jsx}'
  const files = globSync(pattern, {
    ignore: ['**/node_modules/**', '**/.next/**'],
    absolute: true,
  }).filter(f => { const n = f.replace(/\\/g, '/'); return !n.includes('/node_modules/') && !n.includes('/.next/') })

  const links: Link[] = []
  const errors: string[] = []

  for (const file of files) {
    const relFile = path.relative(repoPath, file).replace(/\\/g, '/')
    const ast = parseFile(file)
    if (!ast) {
      errors.push(`Parse failed: ${relFile}`)
      continue
    }

    try {
      traverse(ast, {
        // ── JSX href attributes ──────────────────────────────────────────────
        JSXAttribute(nodePath) {
          const node = nodePath.node
          if (!t.isJSXIdentifier(node.name, { name: 'href' })) return
          if (!node.value) return

          let destination: string | null = null
          if (t.isStringLiteral(node.value)) {
            destination = node.value.value
          } else if (t.isJSXExpressionContainer(node.value)) {
            destination = extractString(node.value.expression as t.Node)
          }
          if (!destination) return

          // Determine whether the parent element is <Link> / <NextLink>
          const parentEl = nodePath.parent
          let kind: Link['kind'] = 'href'
          if (t.isJSXOpeningElement(parentEl)) {
            const elName = parentEl.name
            if (t.isJSXIdentifier(elName) && (elName.name === 'Link' || elName.name === 'NextLink')) {
              kind = 'Link'
            }
          }

          links.push({
            repo: repoName,
            sourceFile: relFile,
            line: node.loc?.start.line ?? 0,
            destination,
            kind,
          })
        },

        // ── router.push / router.replace / redirect() / NextResponse.redirect ──
        CallExpression(nodePath) {
          const node = nodePath.node
          if (!node.arguments.length) return

          let kind: Link['kind'] | null = null
          const callee = node.callee

          if (t.isMemberExpression(callee) && !callee.computed) {
            const prop = callee.property
            const obj = callee.object
            if (t.isIdentifier(prop)) {
              if (prop.name === 'push' && isRouterExpr(obj as t.Expression)) kind = 'routerPush'
              else if (prop.name === 'replace' && isRouterExpr(obj as t.Expression)) kind = 'routerReplace'
              else if (prop.name === 'prefetch' && isRouterExpr(obj as t.Expression)) kind = 'href'
              else if (prop.name === 'redirect' && t.isIdentifier(obj, { name: 'NextResponse' })) kind = 'redirect'
            }
          } else if (t.isIdentifier(callee)) {
            if (callee.name === 'redirect' || callee.name === 'permanentRedirect') kind = 'redirect'
          }

          if (!kind) return

          const firstArg = node.arguments[0]
          if (!t.isExpression(firstArg) && !t.isStringLiteral(firstArg)) return
          const destination = extractString(firstArg as t.Node)
          if (!destination) return

          links.push({
            repo: repoName,
            sourceFile: relFile,
            line: node.loc?.start.line ?? 0,
            destination,
            kind,
          })
        },
      })
    } catch (e: unknown) {
      errors.push(`Traverse error: ${relFile}: ${e instanceof Error ? e.message : String(e)}`)
    }
  }

  return { links, errors }
}
