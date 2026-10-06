import { defineContentScript } from 'wxt/utils/define-content-script';

// Preserve the prototype's runtime registration: no automatic access to sites.
// Later feature PRs can register this bundle after the user grants access.
export default defineContentScript({
  registration: 'runtime',
  main() {
    return { ready: true };
  },
});
