import { deliver } from './platform/deliver.js';
import { presetIdFromMenu, registerMenus } from './platform/menus.js';

chrome.runtime.onInstalled.addListener(() => registerMenus());

chrome.contextMenus.onClicked.addListener((info, tab) => {
  const id = presetIdFromMenu(info.menuItemId);
  if (id) deliver(id, tab);
});
