# Contributing

Create a topic branch and open a pull request; one teammate must review before merging to main. Run the checks listed in the README before requesting review.

## Formatting and hooks

`pnpm install` enables Husky's pre-commit hook. It runs lint-staged against staged JavaScript/TypeScript and formats supported text files. Use `pnpm format` for full-repo formatting. Generated output and the dependency lockfile are excluded from Prettier. Hooks help locally; CI remains the merge gate.

## PR labels

Apply the **AI-generated code** label when AI generates or materially edits code. PR titles describe the change, and the template focuses on scope, validation and review.

## Main branch protection (repository owner action)

In GitHub, open **Settings → Branches → Add branch protection rule**, match `main`, and enable:

1. **Require a pull request before merging** with **1 required approval** and **Dismiss stale pull request approvals when new commits are pushed**.
2. **Do not allow bypassing the above settings** (including administrators).
3. Leave force pushes and deletions disabled.
4. Once the testing/CI PR has merged and its checks have run, enable **Require status checks to pass before merging**, require **CI / verify**, and require branches to be up to date.

This rule prevents direct pushes to main and requires review. The authenticated contributor has push access but not repository administration rights, so only an owner/admin can apply it. Do this after the initial empty-repository seed commit; all implementation changes are submitted as PRs.

## Reviewing the initial PR stack

Merge the MV3 scaffold first, then lint/conventions, then testing/CI. Each later PR is based on the preceding branch so its diff contains only its assigned work. After merging a dependency, retarget the next PR to main and confirm its diff and checks before merging.
