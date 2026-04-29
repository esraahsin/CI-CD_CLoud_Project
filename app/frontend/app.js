'use strict';

// API_BASE is defined in config.js (injected at EC2 boot time)
const BASE_URL = `${API_BASE}/api/todos`;

const form      = document.getElementById('todo-form');
const input     = document.getElementById('todo-input');
const list      = document.getElementById('todo-list');
const errorMsg  = document.getElementById('error-msg');

// ── Helpers ───────────────────────────────────────────────────────────────────

function showError(msg) {
  errorMsg.textContent = msg;
  errorMsg.classList.remove('hidden');
  setTimeout(() => errorMsg.classList.add('hidden'), 4000);
}

async function apiFetch(path, options = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `HTTP ${res.status}`);
  }
  if (res.status === 204) return null;
  return res.json();
}

// ── Render ────────────────────────────────────────────────────────────────────

function renderTodo(todo) {
  const li = document.createElement('li');
  li.dataset.id = todo.id;

  const checkbox = document.createElement('input');
  checkbox.type    = 'checkbox';
  checkbox.checked = Boolean(todo.completed);
  checkbox.addEventListener('change', () => toggleTodo(todo.id, checkbox.checked));

  const title = document.createElement('span');
  title.className = 'todo-title' + (todo.completed ? ' done' : '');
  title.textContent = todo.title;

  const del = document.createElement('button');
  del.className   = 'delete-btn';
  del.textContent = '✕';
  del.title       = 'Delete';
  del.addEventListener('click', () => deleteTodo(todo.id));

  li.append(checkbox, title, del);
  return li;
}

function renderAll(todos) {
  list.innerHTML = '';
  todos.forEach(todo => list.appendChild(renderTodo(todo)));
}

// ── CRUD ──────────────────────────────────────────────────────────────────────

async function loadTodos() {
  try {
    const todos = await apiFetch('/api/todos');
    renderAll(todos);
  } catch (err) {
    showError(`Could not load todos: ${err.message}`);
  }
}

async function addTodo(title) {
  try {
    const todo = await apiFetch('/api/todos', {
      method: 'POST',
      body: JSON.stringify({ title }),
    });
    list.prepend(renderTodo(todo));
  } catch (err) {
    showError(`Could not add todo: ${err.message}`);
  }
}

async function toggleTodo(id, completed) {
  try {
    const updated = await apiFetch(`/api/todos/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ completed }),
    });
    const li    = list.querySelector(`li[data-id="${id}"]`);
    const title = li && li.querySelector('.todo-title');
    if (title) title.classList.toggle('done', Boolean(updated.completed));
  } catch (err) {
    showError(`Could not update todo: ${err.message}`);
    await loadTodos(); // re-sync on failure
  }
}

async function deleteTodo(id) {
  try {
    await apiFetch(`/api/todos/${id}`, { method: 'DELETE' });
    const li = list.querySelector(`li[data-id="${id}"]`);
    if (li) li.remove();
  } catch (err) {
    showError(`Could not delete todo: ${err.message}`);
  }
}

// ── Event listeners ───────────────────────────────────────────────────────────

form.addEventListener('submit', (e) => {
  e.preventDefault();
  const title = input.value.trim();
  if (!title) return;
  input.value = '';
  addTodo(title);
});

// ── Init ──────────────────────────────────────────────────────────────────────

loadTodos();
