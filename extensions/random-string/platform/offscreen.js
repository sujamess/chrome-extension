/** Create the offscreen document unless one exists. Two rapid clicks converge on one
 *  document instead of racing.
 *  @returns {Promise<void>} */
export async function ensureOffscreen() {
  if (await hasOffscreen()) return;
  try {
    await chrome.offscreen.createDocument({
      url: 'platform/offscreen.html',
      reasons: ['CLIPBOARD'],
      justification: 'Write generated strings to the system clipboard',
    });
  } catch {
    if (!(await hasOffscreen())) throw new Error('offscreen document unavailable');
  }
}

async function hasOffscreen() {
  const contexts = await chrome.runtime.getContexts({
    contextTypes: ['OFFSCREEN_DOCUMENT'],
  });
  return contexts.length > 0;
}
