/** The extension states a person can see (design-final §7.13). */
export type ExtensionStatus =
  'on' | 'checking' | 'adapted' | 'paused' | 'attention' | 'cant-run';

/** Default short labels (status pills). The popup passes its own longer titles. */
export const STATUS_LABELS: Record<ExtensionStatus, string> = {
  on: 'On',
  checking: 'Checking this page…',
  adapted: 'Adapted',
  paused: 'Paused on this site',
  attention: 'Needs a look',
  'cant-run': "Can't change this page",
};

/** How long the checking arc turns before it stops and the label changes (`--stop-analyzing`). */
export const STOP_CHECKING_MS = 5000;
