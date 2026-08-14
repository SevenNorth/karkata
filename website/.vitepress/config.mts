import { defineConfig } from 'vitepress'
import { normalizeDocsBase } from '../page-manifest.mjs'

const docsBase = normalizeDocsBase(process.env.KARKATA_DOCS_BASE)

const zhSidebar = [
  { text: '开始', items: [
    { text: '概览', link: '/' },
    { text: '快速开始', link: '/guide/quick-start' },
  ] },
  { text: '集成', items: [
    { text: 'UI 集成', link: '/ui/' },
    { text: '安全边界', link: '/guide/security' },
  ] },
]

const enSidebar = [
  { text: 'Start', items: [
    { text: 'Overview', link: '/en/' },
    { text: 'Quick Start', link: '/en/guide/quick-start' },
  ] },
  { text: 'Integration', items: [
    { text: 'UI Integration', link: '/en/ui/' },
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
    search: { provider: 'local' },
    socialLinks: [{ icon: 'github', link: 'https://github.com/SevenNorth/karkata' }],
    locales: {
      root: {
        nav: [
          { text: '快速开始', link: '/guide/quick-start' },
          { text: 'UI', link: '/ui/' },
          { text: '安全', link: '/guide/security' },
        ],
        sidebar: zhSidebar,
        outline: { label: '本页内容' },
        returnToTopLabel: '返回顶部',
        sidebarMenuLabel: '菜单',
        darkModeSwitchLabel: '主题',
      },
      en: {
        nav: [
          { text: 'Quick Start', link: '/en/guide/quick-start' },
          { text: 'UI', link: '/en/ui/' },
          { text: 'Security', link: '/en/guide/security' },
        ],
        sidebar: enSidebar,
      },
    },
  },
})
