export const pages = Object.freeze([
  page('home', '/', '/en/', '概览', 'Overview'),
  page('quick-start', '/guide/quick-start', '/en/guide/quick-start', '快速开始', 'Quick Start'),
  page('core', '/guide/core', '/en/guide/core', 'Core Runtime', 'Core Runtime'),
  page('tools', '/guide/tools', '/en/guide/tools', '工具', 'Tools'),
  page('streaming', '/guide/streaming', '/en/guide/streaming', '流式回答', 'Streaming'),
  page('human-input', '/guide/human-input', '/en/guide/human-input', '人机协同', 'Human Input'),
  page('ui-overview', '/ui/', '/en/ui/', 'UI 集成', 'UI Integration'),
  page('react', '/ui/react', '/en/ui/react', 'React', 'React'),
  page('vue', '/ui/vue', '/en/ui/vue', 'Vue', 'Vue'),
  page('web-component', '/ui/web-component', '/en/ui/web-component', 'Web Component', 'Web Component'),
  page('openai-compatible', '/provider/openai-compatible', '/en/provider/openai-compatible', 'OpenAI-compatible', 'OpenAI-compatible'),
  page('api', '/api/', '/en/api/', 'API 导航', 'API Map'),
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
