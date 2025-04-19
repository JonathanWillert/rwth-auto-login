// When the user clicks the extension icon:
// 1) set a flag in storage so our content script knows to run
// 2) open a new tab on the Moodle homepage
chrome.action.onClicked.addListener(async () => {
  await chrome.storage.local.set({ autoLoginRequested: true });
  chrome.tabs.create({ url: "https://moodle.rwth-aachen.de/" });
});
