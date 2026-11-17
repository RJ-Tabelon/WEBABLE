// The popup's settings shape, copied from the prototype's @webable/core (types.ts).
// Temporary: move this into packages/core once the core branch is merged, then import it from '@webable/core'.
export const SERVER_ORIGIN = 'http://127.0.0.1:41741';

export interface Settings {
  enabled: boolean;
  pausedOrigins: string[];
  lens: boolean;
  aiLayouts: boolean; // consent for the generative layout model
  serverOrigin: string;
}

export const DEFAULT_SETTINGS: Settings = {
  enabled: true,
  pausedOrigins: [],
  lens: false,
  aiLayouts: true,
  serverOrigin: SERVER_ORIGIN,
};
