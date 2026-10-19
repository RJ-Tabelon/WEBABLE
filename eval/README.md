# Evaluation corpus

A fixed set of pages for testing WebAble adaptations. Keep the list stable so results from different runs can be compared.

## Real sites

[`corpus/sites.json`](corpus/sites.json) lists the real sites to test against. Together they cover news, shopping, government forms, a banking demo, two controlled before/after demos, and a dense single-page app.

Each entry includes:

| Field      | Meaning                                                                                     |
| ---------- | ------------------------------------------------------------------------------------------- |
| `id`       | Stable identifier used in test results and defect logs                                      |
| `category` | `news`, `shopping`, `government`, `government-forms`, `banking-demo`, `controlled` or `spa` |
| `url`      | Site root                                                                                   |
| `persona`  | Study persona the site serves (`A`, `B` or `all`)                                           |
| `why`      | Why the site is in the set                                                                  |
| `pages`    | Paths to visit, relative to the site root                                                   |

## Ground rules

- Read only. No purchases, form submissions or scraping on real sites.
- Never automate a login. The banking demo's published demo credentials are entered by hand only.
- Real sites change. Fixed, offline pages for CI live in `corpus/fixtures/`.

## Changing the list

Adding or removing a site resets regression comparisons. Open a PR, explain why, and note the date in the PR description.
