<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { createDemoAgent } from '../../../examples/ui-demo/demo-agent.mjs'
import { createDemoController } from '../demo-controller.mjs'
import { demoLabels } from '../demo-labels.mjs'

const props = defineProps<{ locale: 'zh' | 'en' }>()
const host = ref<HTMLElement | null>(null)
const ready = ref(false)
const scenario = ref<'order' | 'retryable-error'>('order')

const controller = createDemoController({
  loadPanelModule: () => import('@karkata-ai/ui/web-component'),
  createAgent: (options: { scenario: 'order' | 'retryable-error'; locale: 'zh' | 'en' }) => createDemoAgent(options),
  labels: demoLabels,
})

onMounted(async () => {
  const panel = document.createElement('karkata-panel')
  panel.className = 'docs-karkata-panel'
  host.value?.append(panel)
  await controller.mount(panel, { locale: props.locale, scenario: scenario.value })
  ready.value = true
})

watch(() => props.locale, (locale) => {
  if (ready.value) controller.reset({ locale, scenario: scenario.value })
})

onBeforeUnmount(() => controller.dispose())

function selectScenario(next: 'order' | 'retryable-error') {
  scenario.value = next
  if (ready.value) controller.reset({ locale: props.locale, scenario: next })
}

function reset() {
  if (ready.value) controller.reset({ locale: props.locale, scenario: scenario.value })
}
</script>

<template>
  <section class="demo-workspace" :aria-label="locale === 'zh' ? 'Karkata 离线演示' : 'Karkata offline demo'">
    <header class="demo-toolbar">
      <div class="demo-environment">
        <span class="demo-indicator" aria-hidden="true" />
        <span>{{ locale === 'zh' ? '本地模拟' : 'Local simulation' }}</span>
      </div>
      <div class="demo-actions">
        <div class="scenario-switch" :aria-label="locale === 'zh' ? '演示场景' : 'Demo scenario'">
          <button
            type="button"
            :aria-pressed="scenario === 'order'"
            @click="selectScenario('order')"
          >
            {{ locale === 'zh' ? '订单流程' : 'Order flow' }}
          </button>
          <button
            type="button"
            :aria-pressed="scenario === 'retryable-error'"
            @click="selectScenario('retryable-error')"
          >
            {{ locale === 'zh' ? '错误恢复' : 'Error recovery' }}
          </button>
        </div>
        <button
          class="demo-reset"
          type="button"
          :title="locale === 'zh' ? '重置演示' : 'Reset demo'"
          :aria-label="locale === 'zh' ? '重置演示' : 'Reset demo'"
          @click="reset"
        >
          ↻
        </button>
      </div>
    </header>
    <div ref="host" class="demo-panel-host" :aria-busy="!ready" />
  </section>
</template>

<style scoped>
.demo-workspace {
  min-width: 0;
  overflow: hidden;
  background: #ffffff;
  border: 1px solid #cbd3d7;
  border-radius: 6px;
}

.demo-toolbar {
  min-height: 48px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 7px 10px 7px 14px;
  color: #f5f7f7;
  background: #242a2d;
  border-bottom: 1px solid #171b1d;
}

.demo-environment,
.demo-actions,
.scenario-switch {
  display: flex;
  align-items: center;
}

.demo-environment {
  gap: 8px;
  flex: none;
  color: #d1d7d9;
  font-size: 12px;
  font-weight: 600;
}

.demo-indicator {
  width: 7px;
  height: 7px;
  background: #70c697;
  border-radius: 50%;
}

.demo-actions { min-width: 0; gap: 8px; }

.scenario-switch {
  min-width: 0;
  padding: 2px;
  background: #343b3f;
  border: 1px solid #596267;
  border-radius: 6px;
}

.scenario-switch button,
.demo-reset {
  min-height: 30px;
  color: #dce1e3;
  background: transparent;
  border: 0;
  border-radius: 4px;
  cursor: pointer;
  font: 600 12px/1.2 Inter, ui-sans-serif, system-ui, sans-serif;
  letter-spacing: 0;
}

.scenario-switch button { padding: 0 10px; }
.scenario-switch button[aria-pressed='true'] { color: #17201c; background: #e5f2eb; }
.scenario-switch button:hover:not([aria-pressed='true']),
.demo-reset:hover { background: #434b4f; }

.scenario-switch button:focus-visible,
.demo-reset:focus-visible {
  outline: 2px solid #84b7ee;
  outline-offset: 2px;
}

.demo-reset {
  width: 32px;
  padding: 0;
  flex: none;
  border: 1px solid #596267;
  font-size: 18px;
}

.demo-panel-host {
  height: 560px;
  min-height: 0;
}

.demo-panel-host :deep(.docs-karkata-panel) {
  --karkata-background: #ffffff;
  --karkata-surface: #f1f4f5;
  --karkata-border: #ccd3d6;
  --karkata-text: #171a1c;
  --karkata-muted: #626b70;
  --karkata-accent: #246f50;
  --karkata-danger: #bd372d;
  display: block;
  height: 100%;
}

.demo-panel-host :deep(.docs-karkata-panel)::part(panel) {
  height: 100%;
  min-height: 0;
  max-height: none;
  border: 0;
  border-radius: 0;
}

@media (max-width: 640px) {
  .demo-toolbar {
    align-items: stretch;
    flex-direction: column;
    padding: 9px 10px;
  }

  .demo-actions { justify-content: space-between; }
  .scenario-switch { flex: 1; }
  .scenario-switch button { flex: 1; padding: 0 7px; }
  .demo-panel-host { height: 600px; }
}
</style>
