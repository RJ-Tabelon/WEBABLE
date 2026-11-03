/**
 * Default excluded sites: banking,
 * health portals and government benefits. Pages on these sites are never sent
 * for analysis, whatever the evidence looks like. Local rules still run.
 *
 * The list is short and reviewed on purpose: an entry costs AI help on that
 * site, a missing entry is covered by the other gates (no password or `cc-*`
 * field, no checkout page) and by the vocabulary filter.
 */

/** Registrable domains (eTLD+1), lowercase. */
const EXCLUDED_DOMAINS: ReadonlySet<string> = new Set([
  // Banking and payments.
  'americanexpress.com',
  'ally.com',
  'bankofamerica.com',
  'barclays.co.uk',
  'capitalone.com',
  'chase.com',
  'citi.com',
  'citibank.com',
  'discover.com',
  'fidelity.com',
  'hsbc.co.uk',
  'hsbc.com',
  'lloydsbank.com',
  'natwest.com',
  'navyfederal.org',
  'paypal.com',
  'pnc.com',
  'rbcroyalbank.com',
  'santander.co.uk',
  'schwab.com',
  'td.com',
  'tdbank.com',
  'truist.com',
  'usaa.com',
  'usbank.com',
  'vanguard.com',
  'venmo.com',
  'wellsfargo.com',
  // Health portals and insurers.
  'aetna.com',
  'anthem.com',
  'athenahealth.com',
  'bcbs.com',
  'cigna.com',
  'followmyhealth.com',
  'humana.com',
  'kp.org',
  'labcorp.com',
  'myuhc.com',
  'questdiagnostics.com',
]);

/** Public suffixes whose every site is excluded (government and banks). */
const EXCLUDED_SUFFIXES: readonly string[] = [
  'gov',
  'mil',
  'bank',
  'gov.uk',
  'nhs.uk',
  'nhs.net',
  'gc.ca',
  'gov.au',
  'govt.nz',
  'gov.in',
  'gouv.fr',
];

/** Labels that mark a patient portal on any suffix (`mychart.*`). */
const EXCLUDED_LABELS: ReadonlySet<string> = new Set(['mychart']);

/** True when a site (its eTLD+1) is on the default exclusion list. */
export function isExcludedSite(etld1: string): boolean {
  const domain = etld1.trim().toLowerCase().replace(/\.$/, '');
  if (domain === '') return false;
  if (EXCLUDED_DOMAINS.has(domain)) return true;
  for (const suffix of EXCLUDED_SUFFIXES)
    if (domain === suffix || domain.endsWith(`.${suffix}`)) return true;
  const labels = domain.split('.');
  return labels.slice(0, -1).some((label) => EXCLUDED_LABELS.has(label));
}
