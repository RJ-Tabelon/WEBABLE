// Keep production permissions narrow as in the prototype's runtime injection model.
export function validateManifest(manifest) {
  if (manifest.manifest_version !== 3)
    throw new Error('Manifest V3 is required.');
  if (!manifest.action?.default_popup)
    throw new Error('Popup entry is required.');
  if (
    !manifest.background?.service_worker ||
    manifest.background.type !== 'module'
  )
    throw new Error('Module service worker is required.');
  if (
    JSON.stringify([...(manifest.permissions ?? [])].sort()) !==
    JSON.stringify(['activeTab', 'scripting'])
  )
    throw new Error('Unexpected production permissions.');
  if (
    (manifest.host_permissions ?? []).length ||
    (manifest.optional_host_permissions ?? []).length
  )
    throw new Error('Permanent or optional host access needs review.');
  if ((manifest.content_scripts ?? []).length)
    throw new Error('Content scripts must be injected at runtime.');
}
