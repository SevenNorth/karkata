export const pages = Object.freeze([
  page('home', '/', '/en/', '概览', 'Overview'),
  page('quick-start', '/guide/quick-start', '/en/guide/quick-start', '快速开始', 'Quick Start'),
  page('ui-overview', '/ui/', '/en/ui/', 'UI 集成', 'UI Integration'),
  page('security', '/guide/security', '/en/guide/security', '安全边界', 'Security Boundaries'),
])

export function normalizeDocsBase(value) {
  if (value === undefined || value === '') return '/'
  if (typeof value !== 'string' || /[?#]/.test(value) || value.includes('://')) {
    throw new TypeError('Documentation base must be a URL path')
  }
  const trimmed = value.trim()
  if (!trimmed) return '/'
  const withLeadingSlash = trimmed.startsWith('/') ? trimmed : `/${trimmed}`
  return withLeadingSlash.endsWith('/') ? withLeadingSlash : `${withLeadingSlash}/`
}

function page(id, zh, en, zhTitle, enTitle) {
  return Object.freeze({ id, zh, en, zhTitle, enTitle })
}
