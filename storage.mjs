import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATA_DIR = process.env.VERCEL ? path.join('/tmp', 'data') : path.join(__dirname, 'data');
const STORAGE_FILE = path.join(DATA_DIR, 'assistant_memory.json');

try {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
} catch (e) {
  // Read-only filesystem fallback
}

function getDefaultData() {
  return {
    notes: [],
    tasks: [],
    expenses: [],
    growthHistory: [],
    settings: {
      autoEngagement: true,
      activeHours: { start: 9, end: 23 },
      dailyLikeLimitFB: 25,
      dailyLikeLimitIG: 30
    }
  };
}

let inMemoryData = null;

export function loadStorage() {
  if (inMemoryData) return inMemoryData;
  try {
    if (fs.existsSync(STORAGE_FILE)) {
      inMemoryData = JSON.parse(fs.readFileSync(STORAGE_FILE, 'utf8'));
      return inMemoryData;
    }
  } catch (e) {
    console.warn('[Storage] Read error:', e.message);
  }
  inMemoryData = getDefaultData();
  saveStorage(inMemoryData);
  return inMemoryData;
}

export function saveStorage(data) {
  inMemoryData = data;
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    fs.writeFileSync(STORAGE_FILE, JSON.stringify(data, null, 2), 'utf8');
  } catch (e) {
    console.warn('[Storage] Save error:', e.message);
  }
}

// 1. Task / Reminder Management
export function addTask(text, dueTime = null) {
  const store = loadStorage();
  const task = {
    id: 'task_' + Date.now(),
    text,
    dueTime,
    created: new Date().toISOString(),
    completed: false
  };
  store.tasks.push(task);
  saveStorage(store);
  return task;
}

export function listTasks(onlyPending = true) {
  const store = loadStorage();
  if (onlyPending) {
    return store.tasks.filter(t => !t.completed);
  }
  return store.tasks;
}

export function completeTask(taskId) {
  const store = loadStorage();
  const t = store.tasks.find(x => x.id === taskId || x.text.includes(taskId));
  if (t) {
    t.completed = true;
    saveStorage(store);
    return t;
  }
  return null;
}

// 2. Quick Note & Idea Stash
export function addNote(title, content) {
  const store = loadStorage();
  const note = {
    id: 'note_' + Date.now(),
    title,
    content,
    created: new Date().toISOString()
  };
  store.notes.unshift(note);
  if (store.notes.length > 100) store.notes.pop();
  saveStorage(store);
  return note;
}

export function listNotes(query = '') {
  const store = loadStorage();
  if (!query) return store.notes.slice(0, 15);
  const q = query.toLowerCase();
  return store.notes.filter(n => n.title.toLowerCase().includes(q) || n.content.toLowerCase().includes(q));
}

// 3. Expense & Income Bookkeeper (SohozKarbar Hisab)
export function addTransaction({ type = 'expense', amount, category = 'General', note = '' }) {
  const store = loadStorage();
  const tx = {
    id: 'tx_' + Date.now(),
    date: new Date().toISOString(),
    type,
    amount: parseFloat(amount) || 0,
    category,
    note
  };
  store.expenses.unshift(tx);
  saveStorage(store);
  return tx;
}

export function getExpenseSummary() {
  const store = loadStorage();
  let totalIncome = 0;
  let totalExpense = 0;
  for (const t of store.expenses) {
    if (t.type === 'income') totalIncome += t.amount;
    else totalExpense += t.amount;
  }
  return {
    totalIncome,
    totalExpense,
    balance: totalIncome - totalExpense,
    recentCount: store.expenses.length
  };
}
