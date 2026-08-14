import { defineKarkataPanel } from '/packages/ui/dist/web-component.js'
import { createDemoAgent } from './demo-agent.mjs'

defineKarkataPanel()
const panel = document.querySelector('karkata-panel')
let agent = createDemoAgent()

panel.labels = {
  send: '发送',
  abort: '停止',
  messagePlaceholder: '输入消息',
  responsePlaceholder: '回答当前问题',
  contextSnapshot: '上下文快照',
}
panel.agent = agent

document.querySelector('#reset').addEventListener('click', () => {
  agent.abort()
  agent = createDemoAgent()
  panel.agent = agent
})
