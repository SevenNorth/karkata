import { defineConfig } from 'vitepress'
import { normalizeDocsBase } from '../page-manifest.mjs'

const docsBase = normalizeDocsBase(process.env.KARKATA_DOCS_BASE)

const zhSidebar = [
  { text: '开始', items: [
    { text: '概览', link: '/' },
    { text: '快速开始', link: '/guide/quick-start' },
    { text: 'Core Runtime', link: '/guide/core' },
  ] },
  { text: '能力', items: [
    { text: '工具', link: '/guide/tools' },
    { text: '流式回答', link: '/guide/streaming' },
    { text: '人机协同', link: '/guide/human-input' },
  ] },
  { text: 'UI', items: [
    { text: '集成概览', link: '/ui/' },
    { text: 'React', link: '/ui/react' },
    { text: 'Vue', link: '/ui/vue' },
    { text: 'Web Component', link: '/ui/web-component' },
  ] },
  { text: '参考', items: [
    { text: 'OpenAI-compatible', link: '/provider/openai-compatible' },
    { text: 'API 导航', link: '/api/' },
    { text: '安全边界', link: '/guide/security' },
  ] },
]

const enSidebar = [
  { text: 'Start', items: [
    { text: 'Overview', link: '/en/' },
    { text: 'Quick Start', link: '/en/guide/quick-start' },
    { text: 'Core Runtime', link: '/en/guide/core' },
  ] },
  { text: 'Capabilities', items: [
    { text: 'Tools', link: '/en/guide/tools' },
    { text: 'Streaming', link: '/en/guide/streaming' },
    { text: 'Human Input', link: '/en/guide/human-input' },
  ] },
  { text: 'UI', items: [
    { text: 'Integration Overview', link: '/en/ui/' },
    { text: 'React', link: '/en/ui/react' },
    { text: 'Vue', link: '/en/ui/vue' },
    { text: 'Web Component', link: '/en/ui/web-component' },
  ] },
  { text: 'Reference', items: [
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
    search: { provider: 'local' },
    socialLinks: [{ icon: 'github', link: 'https://github.com/SevenNorth/karkata' }],
    locales: {
      root: {
        nav: [
          { text: '快速开始', link: '/guide/quick-start' },
          { text: '指南', link: '/guide/core' },
          { text: 'UI', link: '/ui/' },
          { text: 'API', link: '/api/' },
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
          { text: 'Guides', link: '/en/guide/core' },
          { text: 'UI', link: '/en/ui/' },
          { text: 'API', link: '/en/api/' },
        ],
        sidebar: enSidebar,
      },
    },
  },
})
