import { readFile } from 'node:fs/promises';

const eventPath = process.env.GITHUB_EVENT_PATH;
if (!eventPath) throw new Error('GITHUB_EVENT_PATH is required.');
const event = JSON.parse(await readFile(eventPath, 'utf8'));
const pr = event.pull_request;
if (pr) {
  const disclosure = pr.body
    ?.match(/^AI used:\s*(Yes|No)\s*$/im)?.[1]
    ?.toLowerCase();
  if (!disclosure)
    throw new Error('Complete the PR template: AI used: Yes / No.');
  const prefix = pr.title.startsWith('[AI-generated code]');
  const label = pr.labels.some((item) => item.name === 'AI-generated code');
  if (
    (disclosure === 'yes' || prefix || label) &&
    !(prefix && label && disclosure === 'yes')
  ) {
    throw new Error(
      'AI-assisted PRs need the [AI-generated code] title prefix, AI-generated code label, and AI used: Yes disclosure.',
    );
  }
}
console.log('PR disclosure convention passed.');
