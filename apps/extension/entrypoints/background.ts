import { defineBackground } from 'wxt/utils/define-background';

export default defineBackground({
  type: 'module',
  main() {
    browser.runtime.onInstalled.addListener(() => {
      console.info('WebAble is ready.');
    });
  },
});
