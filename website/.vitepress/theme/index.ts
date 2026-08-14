import DefaultTheme from 'vitepress/theme'
import KarkataDemo from '../components/KarkataDemo.vue'
import './style.css'

export default {
  extends: DefaultTheme,
  enhanceApp({ app }) {
    app.component('KarkataDemo', KarkataDemo)
  },
}
