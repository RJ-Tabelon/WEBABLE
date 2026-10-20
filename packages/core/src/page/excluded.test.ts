import { describe, expect, it } from 'vitest';

import { isExcludedSite } from './excluded';

describe('isExcludedSite', () => {
  it('excludes banking, health portals and government benefits', () => {
    for (const site of [
      'chase.com',
      'bankofamerica.com',
      'kp.org',
      'ssa.gov',
      'va.gov',
      'service.gov.uk',
      'nhs.uk',
      'example.bank',
      'mychart.org',
      'Chase.com.',
    ])
      expect(isExcludedSite(site), site).toBe(true);
  });

  it('leaves ordinary sites alone', () => {
    for (const site of [
      'example.com',
      'wikipedia.org',
      'govtech.com',
      'banking-news.com',
      'nytimes.com',
      '',
    ])
      expect(isExcludedSite(site), site).toBe(false);
  });
});
