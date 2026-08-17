import { defineConfig } from 'vitepress'
import { normalizeDocsBase } from '../page-manifest.mjs'

const docsBase = normalizeDocsBase(process.env.KARKATA_DOCS_BASE)

const zhSidebar = [
  { text: '开始', collapsed: true, items: [
    { text: '概览', link: '/' },
    { text: '快速开始', link: '/guide/quick-start' },
    { text: 'Core Runtime', link: '/guide/core' },
  ] },
  { text: '能力', collapsed: true, items: [
    { text: '工具', link: '/guide/tools' },
    { text: '流式回答', link: '/guide/streaming' },
    { text: '人机协同', link: '/guide/human-input' },
  ] },
  { text: '生产', collapsed: true, items: [
    { text: '生产架构', link: '/production/architecture' },
    { text: '生产安全', link: '/production/security' },
    { text: '生产配置', link: '/production/configuration' },
    { text: '错误处理', link: '/production/errors' },
    { text: '部署检查', link: '/production/deployment' },
  ] },
  { text: 'UI', collapsed: true, items: [
    { text: '集成概览', link: '/ui/' },
    { text: 'React', link: '/ui/react' },
    { text: 'Vue', link: '/ui/vue' },
    { text: 'Web Component', link: '/ui/web-component' },
  ] },
  { text: '参考', collapsed: true, items: [
    { text: 'OpenAI-compatible', link: '/provider/openai-compatible' },
    { text: 'API 导航', link: '/api/' },
    { text: '安全边界', link: '/guide/security' },
  ] },
]

const enSidebar = [
  { text: 'Start', collapsed: true, items: [
    { text: 'Overview', link: '/en/' },
    { text: 'Quick Start', link: '/en/guide/quick-start' },
    { text: 'Core Runtime', link: '/en/guide/core' },
  ] },
  { text: 'Capabilities', collapsed: true, items: [
    { text: 'Tools', link: '/en/guide/tools' },
    { text: 'Streaming', link: '/en/guide/streaming' },
    { text: 'Human Input', link: '/en/guide/human-input' },
  ] },
  { text: 'Production', collapsed: true, items: [
    { text: 'Architecture', link: '/en/production/architecture' },
    { text: 'Security', link: '/en/production/security' },
    { text: 'Configuration', link: '/en/production/configuration' },
    { text: 'Error Handling', link: '/en/production/errors' },
    { text: 'Deployment Checklist', link: '/en/production/deployment' },
  ] },
  { text: 'UI', collapsed: true, items: [
    { text: 'Integration Overview', link: '/en/ui/' },
    { text: 'React', link: '/en/ui/react' },
    { text: 'Vue', link: '/en/ui/vue' },
    { text: 'Web Component', link: '/en/ui/web-component' },
  ] },
  { text: 'Reference', collapsed: true, items: [
    { text: 'OpenAI-compatible', link: '/en/provider/openai-compatible' },
    { text: 'API Map', link: '/en/api/' },
    { text: 'Security Boundaries', link: '/en/guide/security' },
  ] },
]

export default defineConfig({
  title: 'Karkata',
  description: 'A lightweight, headless agent runtime for TypeScript applications.',
  base: docsBase,
  appearance: false,
  cleanUrls: true,
  lastUpdated: true,
  head: [
    ['meta', { name: 'theme-color', content: '#242a2d' }],
    ['link', { rel: 'icon', type: 'image/svg+xml', href: `${docsBase}favicon.svg` }],
  ],
  locales: {
    root: { label: '简体中文', lang: 'zh-CN' },
    en: { label: 'English', lang: 'en-US', link: '/en/' },
  },
  themeConfig: {
    logo: false,
    sidebar: zhSidebar,
    search: { provider: 'local' },
    socialLinks: [{ icon: 'github', link: 'https://github.com/SevenNorth/karkata' }],
    locales: {
      root: {
        outline: { label: '本页内容' },
        returnToTopLabel: '返回顶部',
        sidebarMenuLabel: '菜单',
        darkModeSwitchLabel: '主题',
      },
      en: {
        sidebar: enSidebar,
      },
    },
  },
})
