// Desktop admin page: edit exercises and routines against the shared backend.
import {
    getAll, put, remove,
    saveExerciseAndTemplates, deleteExerciseCascade
} from './db.js';
import { CATEGORIES } from './seed.js';

const MUSCLES = ['Chest', 'Shoulders', 'Biceps', 'Triceps', 'Quads', 'Glutes', 'Hamstrings'];
const NEW_EXERCISE = '__new_exercise__';
const NEW_ROUTINE = '__new_routine__';

// --- State ---
let exercises = [];
let templates = [];
let selectedExerciseId = null;   // exercise id or NEW_EXERCISE
let selectedRoutineId = null;    // template id or NEW_ROUTINE
let editingRoutineId = null;     // template id being edited in modal, or null = creating
let routineDraft = null;         // working copy of the template in the modal

// --- Data helpers (mirror editor.js semantics) ---
function categoryLinks(ex) {
    return ex.categoryLinks ??
        (ex.categories || [])
            .filter(c => CATEGORIES.includes(c) && ['stretch', 'load'].includes(ex.type))
            .map(c => ({ category: c, type: ex.type }));
}
function muscleGroups(ex) {
    return ex.muscleGroups ?? (MUSCLES.includes(ex.name) ? [ex.name] : []);
}
function isChecklist(t) { return t.inputMode === 'checklist'; }
function clone(x) { return structuredClone ? structuredClone(x) : JSON.parse(JSON.stringify(x)); }
function escapeHtml(v) {
    return String(v ?? '').replace(/[&<>"']/g, ch => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[ch]));
}
function byName(a, b) { return (a.name || '').localeCompare(b.name || ''); }
// crypto.randomUUID() is only available in secure contexts (HTTPS/localhost).
// Fall back to a timestamp+random id so the admin page works on plain http://LAN-IP.
function newId(prefix) {
    const rand = (typeof crypto !== 'undefined' && crypto.randomUUID)
        ? crypto.randomUUID()
        : Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
    return `${prefix}_${rand}`;
}

// --- DOM refs ---
const $ = id => document.getElementById(id);
const exerciseSelect = $('exercise-select');
const routineSelect = $('routine-select');

// --- Toast ---
let toastTimer;
function showToast(msg) {
    const t = $('toast');
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.remove('show'), 2600);
}

// --- Data loading ---
async function loadData() {
    [exercises, templates] = await Promise.all([
        getAll('exercises'),
        getAll('templates')
    ]);
}
async function refresh() {
    await loadData();
    renderExerciseSelect();
    renderRoutineSelect();
    renderExerciseForm();
    renderRoutineSummary();
}

// ================= Exercise editor =================

function renderExerciseSelect() {
    const current = selectedExerciseId;
    exerciseSelect.innerHTML = '';
    const optNew = new Option('＋ Add new exercise…', NEW_EXERCISE);
    exerciseSelect.add(optNew);
    [...exercises].sort(byName).forEach(ex => exerciseSelect.add(new Option(ex.name, ex.id)));
    // Restore selection if it still exists, otherwise keep the new option.
    if (current && exercises.some(e => e.id === current)) exerciseSelect.value = current;
    else if (current === NEW_EXERCISE) exerciseSelect.value = NEW_EXERCISE;
    else exerciseSelect.value = NEW_EXERCISE;
}

function selectedExercise() {
    return exercises.find(e => e.id === selectedExerciseId) || null;
}

function renderExerciseForm() {
    const ex = selectedExercise();
    const isNew = !ex;
    $('ex-name').value = ex?.name || '';
    $('ex-instructions').value = ex?.instructions || '';
    $('ex-delete').disabled = isNew;
    $('exercise-error').textContent = '';

    const links = ex ? categoryLinks(ex) : [];
    const groups = ex ? muscleGroups(ex) : [];

    // Category table
    const tbody = $('category-rows');
    tbody.innerHTML = '';
    CATEGORIES.forEach(cat => {
        const tr = document.createElement('tr');
        const nameTd = document.createElement('td');
        nameTd.className = 'cat-name';
        nameTd.textContent = cat;
        tr.appendChild(nameTd);
        ['stretch', 'load'].forEach(type => {
            const td = document.createElement('td');
            const cb = document.createElement('input');
            cb.type = 'checkbox';
            cb.dataset.category = cat;
            cb.dataset.type = type;
            cb.checked = links.some(l => l.category === cat && l.type === type);
            td.appendChild(cb);
            tr.appendChild(td);
        });
        tbody.appendChild(tr);
    });

    // Muscle chips
    const chips = $('muscle-chips');
    chips.innerHTML = '';
    MUSCLES.forEach(m => {
        const label = document.createElement('label');
        label.className = 'chip' + (groups.includes(m) ? ' checked' : '');
        const cb = document.createElement('input');
        cb.type = 'checkbox';
        cb.dataset.group = m;
        cb.checked = groups.includes(m);
        cb.addEventListener('change', () => label.classList.toggle('checked', cb.checked));
        label.append(cb, document.createTextNode(m));
        chips.appendChild(label);
    });

    renderMembership(ex);
}

function renderMembership(ex) {
    const list = $('membership-list');
    list.innerHTML = '';
    if (templates.length === 0) {
        list.innerHTML = '<p class="empty">No routines yet. Add one from the Routine panel.</p>';
        return;
    }
    [...templates].sort(byName).forEach(t => {
        const member = ex ? t.exercises.find(e => e.id === ex.id) : null;
        const row = document.createElement('div');
        row.className = 'membership-row' + (member ? '' : ' disabled');
        row.dataset.templateId = t.id;

        const check = document.createElement('div');
        check.className = 'check';
        const cb = document.createElement('input');
        cb.type = 'checkbox';
        cb.checked = !!member;
        cb.addEventListener('change', () => {
            row.classList.toggle('disabled', !cb.checked);
            row.querySelectorAll('.defaults').forEach(d => d.style.display = cb.checked ? 'flex' : 'none');
        });
        const span = document.createElement('span');
        span.textContent = t.name;
        span.title = t.name;
        check.append(cb, span);
        row.appendChild(check);

        if (isChecklist(t)) {
            const note = document.createElement('span');
            note.className = 'checklist-note';
            note.textContent = 'checklist';
            row.appendChild(note);
        } else {
            const defaults = document.createElement('div');
            defaults.className = 'defaults';
            defaults.style.display = member ? 'flex' : 'none';
            defaults.innerHTML = `
                <label>Sets</label><input type="text" data-field="defaultSets" value="${escapeHtml(member?.defaultSets ?? 3)}">
                <label>Reps</label><input type="text" data-field="defaultReps" value="${escapeHtml(member?.defaultReps ?? '')}">
            `;
            row.appendChild(defaults);
        }
        list.appendChild(row);
    });
}

function collectExercise() {
    const name = $('ex-name').value.trim();
    if (!name) { $('exercise-error').textContent = 'Enter an exercise name.'; return null; }
    if (/[<>"&]/.test(name)) { $('exercise-error').textContent = 'Avoid <, >, &, or " in the name.'; return null; }
    if (exercises.some(e => e.id !== selectedExerciseId && e.name.toLowerCase() === name.toLowerCase())) {
        $('exercise-error').textContent = 'An exercise with this name already exists.';
        return null;
    }
    const instructions = $('ex-instructions').value.trim();
    const links = [...document.querySelectorAll('#category-rows input:checked')]
        .map(cb => ({ category: cb.dataset.category, type: cb.dataset.type }));
    const groups = [...document.querySelectorAll('#muscle-chips input:checked')]
        .map(cb => cb.dataset.group);

    const base = selectedExercise() || {};
    const exercise = {
        ...base,
        id: base.id || newId('ex'),
        name,
        instructions,
        categoryLinks: links,
        muscleGroups: groups,
        categories: [...new Set(links.map(l => l.category))],
        type: links[0]?.type || 'n/a',
        userEdited: true
    };

    // Compute which templates changed membership.
    const updates = [];
    for (const row of document.querySelectorAll('#membership-list .membership-row')) {
        const t = templates.find(x => x.id === row.dataset.templateId);
        if (!t) continue;
        const cb = row.querySelector('.check input');
        const old = t.exercises.find(e => e.id === exercise.id);
        if (!cb.checked && !old) continue;

        let entries = t.exercises.map(e => ({ ...e }));
        if (!cb.checked) {
            entries = entries.filter(e => e.id !== exercise.id);
        } else {
            let member = old ? { ...old } : { id: exercise.id };
            if (isChecklist(t)) member.checklist = true;
            else {
                member.defaultSets = row.querySelector('[data-field="defaultSets"]')?.value.trim() ?? member.defaultSets ?? 3;
                member.defaultReps = row.querySelector('[data-field="defaultReps"]')?.value.trim() ?? member.defaultReps ?? '';
            }
            entries = old ? entries.map(e => e.id === exercise.id ? member : e) : [...entries, member];
        }
        if (JSON.stringify(entries) !== JSON.stringify(t.exercises)) {
            updates.push({ ...t, exercises: entries, userEdited: true });
        }
    }
    return { exercise, updates };
}

async function saveExercise() {
    const result = collectExercise();
    if (!result) return;
    const btn = $('ex-save');
    btn.disabled = true;
    try {
        await saveExerciseAndTemplates(result.exercise, result.updates);
        selectedExerciseId = result.exercise.id;
        await refresh();
        showToast('Exercise saved.');
    } catch (err) {
        $('exercise-error').textContent = 'Could not save: ' + err.message;
    } finally {
        btn.disabled = false;
    }
}

async function deleteExercise() {
    const ex = selectedExercise();
    if (!ex) return;
    if (!window.confirm(`Delete "${ex.name}"? It will also be removed from all routines.`)) return;
    try {
        await deleteExerciseCascade(ex.id);
        selectedExerciseId = NEW_EXERCISE;
        await refresh();
        showToast('Exercise deleted.');
    } catch (err) {
        $('exercise-error').textContent = 'Could not delete: ' + err.message;
    }
}

// ================= Routine manager =================

function renderRoutineSelect() {
    const current = selectedRoutineId;
    routineSelect.innerHTML = '';
    routineSelect.add(new Option('＋ Add new routine…', NEW_ROUTINE));
    [...templates].sort(byName).forEach(t => routineSelect.add(new Option(t.name, t.id)));
    if (current && templates.some(t => t.id === current)) routineSelect.value = current;
    else if (current === NEW_ROUTINE) routineSelect.value = NEW_ROUTINE;
    else routineSelect.value = NEW_ROUTINE;
}

function selectedRoutine() {
    return templates.find(t => t.id === selectedRoutineId) || null;
}

function renderRoutineSummary() {
    const box = $('routine-summary');
    const editBtn = $('routine-edit');
    const t = selectedRoutine();
    if (!t) {
        box.innerHTML = '<span class="empty">Select a routine to view or edit it.</span>';
        editBtn.disabled = true;
        return;
    }
    const count = t.exercises.length;
    const badge = isChecklist(t)
        ? '<span class="badge checklist">checklist</span>'
        : '<span class="badge">sets / reps</span>';
    box.innerHTML = `
        <div class="name">${escapeHtml(t.name)}</div>
        <div>${escapeHtml(t.description || 'No description')}</div>
        <div class="meta">${badge} &nbsp;·&nbsp; ${count} exercise${count === 1 ? '' : 's'}</div>
    `;
    editBtn.disabled = false;
}

// --- Routine modal ---
function openRoutineModal(templateId) {
    editingRoutineId = templateId; // null => creating
    const existing = templates.find(t => t.id === templateId) || null;
    routineDraft = existing
        ? clone(existing)
        : { id: newId('rt'), name: '', description: '', exercises: [] };

    $('routine-modal-title').textContent = existing ? 'Edit Routine' : 'New Routine';
    $('routine-modal-sub').textContent = existing
        ? 'Rename, edit exercises, or delete this routine.'
        : 'Create a new routine and choose its exercises.';
    $('rt-name').value = routineDraft.name;
    $('rt-desc').value = routineDraft.description || '';
    $('rt-delete').style.display = existing ? '' : 'none';
    $('routine-error').textContent = '';
    renderRoutineModalExercises();
    $('routine-modal').classList.add('open');
    $('rt-name').focus();
}

function closeRoutineModal() {
    $('routine-modal').classList.remove('open');
    editingRoutineId = null;
    routineDraft = null;
}

function renderRoutineModalExercises() {
    const list = $('rt-ex-list');
    list.innerHTML = '';
    if (routineDraft.exercises.length === 0) {
        list.innerHTML = '<p class="empty">No exercises yet. Add one below.</p>';
    } else {
        routineDraft.exercises.forEach((entry, idx) => {
            const ex = exercises.find(e => e.id === entry.id);
            const row = document.createElement('div');
            row.className = 'routine-ex-row';
            const name = document.createElement('span');
            name.className = 'name';
            name.textContent = ex ? ex.name : 'Unknown exercise';
            row.appendChild(name);

            if (!isChecklist(routineDraft)) {
                const defaults = document.createElement('div');
                defaults.className = 'defaults';
                defaults.innerHTML = `
                    <label>Sets</label><input type="text" data-idx="${idx}" data-field="defaultSets" value="${escapeHtml(entry.defaultSets ?? 3)}">
                    <label>Reps</label><input type="text" data-idx="${idx}" data-field="defaultReps" value="${escapeHtml(entry.defaultReps ?? '')}">
                `;
                defaults.querySelectorAll('input').forEach(inp => {
                    inp.addEventListener('input', () => {
                        routineDraft.exercises[Number(inp.dataset.idx)][inp.dataset.field] = inp.value;
                    });
                });
                row.appendChild(defaults);
            }

            const rm = document.createElement('button');
            rm.className = 'remove';
            rm.type = 'button';
            rm.title = 'Remove from routine';
            rm.innerHTML = '&times;';
            rm.addEventListener('click', () => {
                routineDraft.exercises.splice(idx, 1);
                renderRoutineModalExercises();
            });
            row.appendChild(rm);
            list.appendChild(row);
        });
    }

    // Add-exercise select: all exercises not already in the routine.
    const sel = $('rt-add-select');
    const inRoutine = new Set(routineDraft.exercises.map(e => e.id));
    sel.innerHTML = '';
    sel.add(new Option('— Select exercise —', ''));
    [...exercises].sort(byName)
        .filter(e => !inRoutine.has(e.id))
        .forEach(e => sel.add(new Option(e.name, e.id)));
}

function addRoutineExercise() {
    const sel = $('rt-add-select');
    if (!sel.value) return;
    const entry = { id: sel.value, defaultSets: 3, defaultReps: '' };
    if (isChecklist(routineDraft)) entry = { id: sel.value, checklist: true };
    routineDraft.exercises.push(entry);
    renderRoutineModalExercises();
}

async function saveRoutine() {
    const name = $('rt-name').value.trim();
    if (!name) { $('routine-error').textContent = 'Enter a routine name.'; return; }
    if (/[<>"&]/.test(name)) { $('routine-error').textContent = 'Avoid <, >, &, or " in the name.'; return; }
    routineDraft.name = name;
    routineDraft.description = $('rt-desc').value.trim();
    routineDraft.userEdited = true;

    const btn = $('rt-save');
    btn.disabled = true;
    try {
        await put('templates', routineDraft);
        selectedRoutineId = routineDraft.id;
        closeRoutineModal();
        await refresh();
        showToast('Routine saved.');
    } catch (err) {
        $('routine-error').textContent = 'Could not save: ' + err.message;
    } finally {
        btn.disabled = false;
    }
}

async function deleteRoutine() {
    if (!editingRoutineId) return;
    const t = templates.find(x => x.id === editingRoutineId);
    if (!t) return;
    if (!window.confirm(`Delete routine "${t.name}"? This cannot be undone.`)) return;
    try {
        await remove('templates', t.id);
        selectedRoutineId = NEW_ROUTINE;
        closeRoutineModal();
        await refresh();
        showToast('Routine deleted.');
    } catch (err) {
        $('routine-error').textContent = 'Could not delete: ' + err.message;
    }
}

// ================= Events =================
exerciseSelect.addEventListener('change', () => {
    selectedExerciseId = exerciseSelect.value;
    renderExerciseForm();
});
$('ex-save').addEventListener('click', saveExercise);
$('ex-delete').addEventListener('click', deleteExercise);

routineSelect.addEventListener('change', () => {
    selectedRoutineId = routineSelect.value;
    renderRoutineSummary();
    // Selecting a routine (existing or new) goes straight to the editor.
    if (selectedRoutineId === NEW_ROUTINE) openRoutineModal(null);
    else if (selectedRoutineId) openRoutineModal(selectedRoutineId);
});
$('routine-edit').addEventListener('click', () => {
    if (selectedRoutineId && selectedRoutineId !== NEW_ROUTINE) openRoutineModal(selectedRoutineId);
});

$('rt-save').addEventListener('click', saveRoutine);
$('rt-delete').addEventListener('click', deleteRoutine);
$('rt-cancel').addEventListener('click', closeRoutineModal);
$('rt-add-btn').addEventListener('click', addRoutineExercise);
$('routine-modal').addEventListener('click', e => { if (e.target === $('routine-modal')) closeRoutineModal(); });
document.addEventListener('keydown', e => { if (e.key === 'Escape' && $('routine-modal').classList.contains('open')) closeRoutineModal(); });

// ================= Init =================
(async function init() {
    try {
        await refresh();
    } catch (err) {
        showToast('Could not load data: ' + err.message);
    }
})();
