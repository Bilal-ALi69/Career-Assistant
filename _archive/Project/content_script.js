chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'getSelection') {
    const selectedText = window.getSelection().toString().trim();
    sendResponse({ selected: selectedText });
  }
});
