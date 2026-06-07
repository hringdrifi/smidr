import DefaultTheme from 'vitepress/theme';
import { h } from 'vue';
import './custom.css';
import DocsImageLightbox from './DocsImageLightbox.vue';

export default {
  extends: DefaultTheme,
  Layout() {
    return h(DefaultTheme.Layout, null, {
      'layout-bottom': () => h(DocsImageLightbox),
    });
  },
};
