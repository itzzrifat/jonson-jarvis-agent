import { loadStorage, addTask, listTasks, addTransaction, getExpenseSummary, addNote, listNotes } from './storage.mjs';

console.log('Testing Jonson Cloud Agent core modules...');

// 1. Test Storage
const store = loadStorage();
console.log('Storage initialized:', !!store);

const task = addTask('Test automated cloud reminder');
console.log('Task added:', task.text);

const pending = listTasks(true);
console.log('Pending tasks count:', pending.length);

const note = addNote('Cloud Agent Note', 'Testing persistent memory stash');
console.log('Note added:', note.title);

const tx = addTransaction({ type: 'income', amount: 1500, category: 'Software Sales', note: 'SohozKarbar ERP license' });
console.log('Transaction added:', tx.amount, tx.category);

const fin = getExpenseSummary();
console.log('Financial summary:', fin);

console.log('All local tests passed successfully!');
