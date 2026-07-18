const saveHighlightButton = document.getElementById('save-highlight');
const newNoteButton = document.getElementById('new-note');
const manualEntry = document.getElementById('manual-entry');
const manualText = document.getElementById('manual-text');
const saveManualButton = document.getElementById('save-manual');
const cancelManualButton = document.getElementById('cancel-manual');
const notesContainer = document.getElementById('notes');
const noteCount = document.getElementById('note-count');

function formatTimestamp(value) {
  return new Date(value).toLocaleString([], {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

function renderNotes(notes = []) {
  notesContainer.innerHTML = '';
  noteCount.textContent = notes.length;

  if (notes.length === 0) {
    const emptyState = document.createElement('p');
    emptyState.className = 'empty-state';
    emptyState.textContent = 'No notes yet. Save a highlight to get started.';
    notesContainer.appendChild(emptyState);
    return;
  }

  notes.forEach((note, index) => {
    const noteItem = document.createElement('article');
    noteItem.className = 'note-item';

    const noteText = document.createElement('p');
    noteText.textContent = note.text;

    const noteMeta = document.createElement('div');
    noteMeta.className = 'note-meta';
    const sourceText = document.createElement('span');
    sourceText.textContent = note.source;
    const timestampText = document.createElement('span');
    timestampText.textContent = formatTimestamp(note.createdAt);
    noteMeta.append(sourceText, timestampText);

    const deleteButton = document.createElement('button');
    deleteButton.className = 'delete-note';
    deleteButton.dataset.index = index;
    deleteButton.title = 'Remove note';
    deleteButton.textContent = '×';

    noteItem.append(noteText, noteMeta, deleteButton);
    notesContainer.appendChild(noteItem);
  });
}

function loadNotes() {
  chrome.storage.local.get({ notes: [] }, (result) => {
    renderNotes(result.notes);
  });
}

function saveNote(text, source) {
  if (!text.trim()) {
    return;
  }

  chrome.storage.local.get({ notes: [] }, (result) => {
    const notes = result.notes;
    notes.unshift({ text: text.trim(), source, createdAt: Date.now() });
    chrome.storage.local.set({ notes }, () => {
      renderNotes(notes);
      manualText.value = '';
      manualEntry.classList.add('hidden');
    });
  });
}

function deleteNote(index) {
  chrome.storage.local.get({ notes: [] }, (result) => {
    const notes = result.notes;
    notes.splice(index, 1);
    chrome.storage.local.set({ notes }, () => {
      renderNotes(notes);
    });
  });
}

function getSelectedTextFromCurrentTab() {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    const tab = tabs[0];
    if (!tab?.id) {
      return;
    }

    chrome.scripting.executeScript(
      {
        target: { tabId: tab.id },
        func: () => window.getSelection().toString().trim(),
      },
      (injectionResults) => {
        const selected = injectionResults?.[0]?.result;
        if (!selected) {
          alert('Please highlight text on the page before saving.');
          return;
        }

        saveNote(selected, new URL(tab.url || '').hostname || 'Web page');
      }
    );
  });
}

saveHighlightButton.addEventListener('click', getSelectedTextFromCurrentTab);
newNoteButton.addEventListener('click', () => {
  manualEntry.classList.toggle('hidden');
  manualText.focus();
});

saveManualButton.addEventListener('click', () => {
  const text = manualText.value;
  if (!text.trim()) {
    return;
  }
  saveNote(text, 'Manual entry');
});

cancelManualButton.addEventListener('click', () => {
  manualText.value = '';
  manualEntry.classList.add('hidden');
});

notesContainer.addEventListener('click', (event) => {
  const target = event.target;
  if (target.matches('.delete-note')) {
    const index = Number(target.dataset.index);
    deleteNote(index);
  }
});

loadNotes();
