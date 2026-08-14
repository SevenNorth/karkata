import { defineKarkataPanel } from '/packages/ui/dist/web-component.js'
import { createDemoAgent } from './demo-agent.mjs'

defineKarkataPanel()
const panel = document.querySelector('karkata-panel')
let agent = createDemoAgent()

panel.labels = {
  send: '发送',
  abort: '停止',
  retry: '重试',
  messagePlaceholder: '输入消息',
  responsePlaceholder: '回答当前问题',
  contextSnapshot: '上下文快照',
  empty: '开始一段对话',
  statusIdle: '已就绪',
  statusRunning: '正在处理',
  statusWaitingForInput: '等待你的回答',
  statusCompleted: '已完成',
  statusError: '遇到问题',
  statusAborted: '已停止',
  statusDisposed: '暂不可用',
  requestPending: '等待你的回答',
  requestCancelled: '已取消',
  toolPending: '正在处理',
  toolCompleted: '已完成',
  toolError: '执行失败',
  responseRejected: '这个问题已失效，回答未发送。',
  operationFailed: '操作失败，请稍后重试。',
}
panel.agent = agent

document.querySelector('#reset').addEventListener('click', () => {
  agent.abort()
  agent = createDemoAgent()
  panel.agent = agent
})
