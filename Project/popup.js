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
    notesContainer.innerHTML = '<p class="empty-state">No notes yet. Save a highlight to get started.</p>';
    return;
  }

  notes.forEach((note, index) => {
    const noteItem = document.createElement('article');
    noteItem.className = 'note-item';

    noteItem.innerHTML = `
      <p>${note.text}</p>
      <div class="note-meta">
        <span>${note.source}</span>
        <span>${formatTimestamp(note.createdAt)}</span>
      </div>
      <button class="delete-note" data-index="${index}" title="Remove note">×</button>
    `;

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

    chrome.tabs.sendMessage(tab.id, { type: 'getSelection' }, (response) => {
      if (!response || !response.selected) {
        alert('Please highlight text on the page before saving.');
        return;
      }

      saveNote(response.selected, new URL(tab.url || '').hostname || 'Web page');
    });
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
