// NotebookLM Organizer - Background Service Worker

chrome.action.onClicked.addListener((tab) => {
  const isNotebook = tab?.url && (
    tab.url.startsWith("https://notebook.google.com/") ||
    tab.url.startsWith("https://notebook.google/") ||
    tab.url.startsWith("https://notebooklm.google.com/") ||
    tab.url.startsWith("https://notebooklm.google/")
  );

  if (!isNotebook) {
    chrome.tabs.create({ url: "https://notebook.google.com/" });
  }
});
