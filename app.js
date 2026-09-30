import { setupExerciseEditor, categoryLinks, muscleGroups } from './editor.js';
import { initDB, getAll, get, put, putAll, remove } from './db.js';
import { CATEGORIES, checkAndSeedDB } from './seed.js';

// --- State ---
let currentView = 'view-dashboard';
let exercisesMap = {};
let templatesList = [];
let workoutLogs = [];
let historyFilter = 'all';

// Workout detail/edit modal state
let modalLogId = null;
let modalEditEntries = [];

let currentWorkoutForm = {
    kind: 'pt', // pt, neck, other
    entries: [],
    notes: '',
    routineId: null,
    routineName: null
};

// --- Routine badges (History tab) ---
// Fixed palette so each routine keeps a stable, visually distinct color.
const ROUTINE_BADGE_COLORS = ['#1a73e8', '#d93025', '#188038', '#e37400', '#9334e6', '#00796b', '#c2185b', '#5f6368'];

function getRoutineLetter(name) {
    const match = /^(?:Session|Routine)\s+([A-Za-z])\b/.exec(name || '');
    if (match) return match[1].toUpperCase();
    return (name || '').trim().charAt(0).toUpperCase() || '?';
}

function getRoutineColor(routineId) {
    let hash = 0;
    for (let i = 0; i < routineId.length; i++) hash = (hash * 31 + routineId.charCodeAt(i)) >>> 0;
    return ROUTINE_BADGE_COLORS[hash % ROUTINE_BADGE_COLORS.length];
}

// Returns { letter, color } for a log's originating routine, or null if the
// workout wasn't logged from a routine (freeform/other/single-exercise logs).
function getRoutineBadge(routineId, routineName) {
    if (!routineId) return null;
    return { letter: getRoutineLetter(routineName), color: getRoutineColor(routineId) };
}

// --- Initialization ---
document.addEventListener('DOMContentLoaded', async () => {
    await initDB();
    await checkAndSeedDB();
    await loadData();
    
    setupNavigation();
    setupEventListeners();
    setupExerciseEditor(async () => {
        await loadData();
        renderDashboard();
        renderTemplates();
        renderRoutinesTab();
        renderHistory();
        closeWorkoutForm();
    });
    
    renderDashboard();
    renderTemplates();
    renderRoutinesTab();
    renderHistory();

    document.addEventListener('visibilitychange', () => {
        if (!document.hidden) refreshDataAndRender().catch(console.error);
    });
});

async function loadData() {
    const [exList, templates, logs] = await Promise.all([
        getAll('exercises'),
        getAll('templates'),
        getAll('workout_logs')
    ]);

    exercisesMap = {};
    exList.forEach(ex => exercisesMap[ex.id] = ex);
    templatesList = templates;
    workoutLogs = logs;
    // Sort logs descending by date
    workoutLogs.sort((a, b) => b.date - a.date);
}

async function refreshDataAndRender(viewId = currentView) {
    await loadData();
    renderDashboard();
    renderTemplates();
    renderRoutinesTab();
    renderHistory();
    if (viewId === 'view-log') populateExerciseSelect(document.getElementById('exercise-select'));
}

// --- Navigation ---
function setupNavigation() {
    const navItems = document.querySelectorAll('.nav-item');
    navItems.forEach(item => {
        item.addEventListener('click', () => {
            const targetId = item.getAttribute('data-target');
            if (targetId) switchView(targetId);
            
            navItems.forEach(n => n.classList.remove('active'));
            item.classList.add('active');
        });
    });
}

async function switchView(viewId) {
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    document.getElementById(viewId).classList.add('active');
    currentView = viewId;
    window.scrollTo(0,0);

    // Freshness strategy for shared backend: every tab/view switch refetches
    // current server state so a second device's changes become visible quickly.
    try {
        await refreshDataAndRender(viewId);
    } catch (error) {
        console.error(error);
        showToast('Could not refresh latest data.');
    }
}

// --- Dashboard ---
function renderDashboard() {
    const now = Date.now();
    const msInDay = 24 * 60 * 60 * 1000;
    
    // Calculate last logged for each category+type
    const lastLogged = {}; // category -> { stretch: ts, load: ts }
    CATEGORIES.forEach(c => lastLogged[c] = { stretch: 0, load: 0 });
    
    let neckCountThisWeek = 0;
    
    // Find the start of the current week (Monday at 00:00:00 local time)
    const currentDate = new Date(now);
    const dayOfWeek = currentDate.getDay(); // 0 is Sunday, 1 is Monday
    const daysSinceMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
    const lastMonday = new Date(currentDate.getFullYear(), currentDate.getMonth(), currentDate.getDate() - daysSinceMonday, 0, 0, 0, 0);
    const startOfWeekMs = lastMonday.getTime();
    
    workoutLogs.forEach(log => {
        if (log.workout_kind === 'neck' && log.date >= startOfWeekMs) {
            neckCountThisWeek++;
        }
        
        if (log.workout_kind !== 'pt') return;
        
        log.entries.forEach(entry => {
            const ex = exercisesMap[entry.exercise_id];
            if (!ex || !ex.categories) return;
            
            categoryLinks(ex).forEach(({ category, type }) => {
                if (lastLogged[category] && log.date > lastLogged[category][type]) {
                    lastLogged[category][type] = log.date;
                }
            });
        });
    });
    
    // Render Matrix
    const matrixEl = document.getElementById('dashboard-matrix');
    matrixEl.innerHTML = '';
    
    let overdueCount = 0;
    
    CATEGORIES.forEach(cat => {
        const row = document.createElement('div');
        row.className = 'matrix-row';
        
        // Cat Name
        const nameCell = document.createElement('div');
        nameCell.className = 'matrix-cell category-name';
        nameCell.textContent = cat;
        row.appendChild(nameCell);
        
        // Stretch & Load cells
        ['stretch', 'load'].forEach(type => {
            const cell = document.createElement('div');
            cell.className = 'matrix-cell';
            
            const ts = lastLogged[cat][type];
            const daysAgo = ts === 0 ? Infinity : Math.floor((now - ts) / msInDay);
            
            if (daysAgo < 7) {
                cell.classList.add('status-green');
                cell.innerHTML = `<span class="status-dot status-green-dot"></span><span>${daysAgo === 0 ? 'Today' : `${daysAgo}d`}</span>`;
            } else if (daysAgo < 14) {
                cell.classList.add('status-yellow');
                cell.innerHTML = `<span class="status-dot status-yellow-dot"></span><span>${daysAgo}d</span>`;
            } else {
                cell.classList.add('status-red');
                cell.innerHTML = `<span class="status-dot status-red-dot"></span><span>${ts === 0 ? 'Never' : `${daysAgo}d`}</span>`;
                overdueCount++;
            }
            
            cell.setAttribute('role', 'button');
            cell.setAttribute('tabindex', '0');
            cell.setAttribute('aria-label', `${cat} ${type}: ${cell.textContent}`);
            cell.addEventListener('click', () => openCategoryModal(cat, type));
            cell.addEventListener('keydown', event => {
                if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    openCategoryModal(cat, type);
                }
            });
            
            row.appendChild(cell);
        });
        
        matrixEl.appendChild(row);
    });
    
    document.getElementById('neck-streak').textContent = `${neckCountThisWeek} / 5`;
    document.getElementById('overdue-count').textContent = overdueCount;
}

// --- Quick Log / Forms ---
function renderTemplates() {
    const listEl = document.getElementById('template-list');
    listEl.innerHTML = '';
    
    templatesList.forEach(t => {
        const el = document.createElement('div');
        el.className = 'template-item';
        el.innerHTML = `
            <div class="template-title">${t.name}</div>
            <div class="template-desc">${t.description}</div>
            <button class="btn btn-secondary btn-sm mt-2">Log this session</button>
        `;
        el.querySelector('button').addEventListener('click', () => {
            openWorkoutForm(t.workoutKind || 'pt', t.exercises, t);
        });
        listEl.appendChild(el);
    });
}

function renderRoutinesTab() {
    const listEl = document.getElementById('routines-list');
    if (!listEl) return;
    listEl.innerHTML = '';
    
    templatesList.forEach(t => {
        const el = document.createElement('div');
        el.className = 'template-item';
        
        const exHtml = t.exercises.map(exObj => {
            const ex = exercisesMap[exObj.id];
            return t.inputMode === 'checklist'
                ? `<li>${ex ? ex.name : 'Unknown'} <span class="category-hint">${ex ? formatCategoryTags(ex) : ''}</span></li>`
                : `<li>${ex ? ex.name : 'Unknown'} - ${exObj.defaultSets} sets x ${exObj.defaultReps}</li>`;
        }).join('');
        
        el.innerHTML = `
            <div class="template-title" style="cursor: pointer; display: flex; justify-content: space-between; align-items: center;">
                <span>${t.name}</span>
                <span class="expand-icon" style="font-size: 12px;">▼</span>
            </div>
            <div class="template-desc mb-2">${t.description || ''}</div>
            <div class="routine-ex-list hidden mt-2" style="border-top: 1px solid var(--border-color); padding-top: 8px;">
                <ul style="font-size:13px; margin-left:16px; margin-bottom:12px; color:var(--text-primary); list-style-type:circle;">${exHtml}</ul>
                <button class="btn btn-secondary btn-sm mt-2 w-100 btn-log-from-routine">Log this routine</button>
            </div>
        `;
        
        el.querySelector('.template-title').addEventListener('click', () => {
            const list = el.querySelector('.routine-ex-list');
            const icon = el.querySelector('.expand-icon');
            if (list.classList.contains('hidden')) {
                list.classList.remove('hidden');
                icon.textContent = '▲';
            } else {
                list.classList.add('hidden');
                icon.textContent = '▼';
            }
        });
        
        el.querySelector('.btn-log-from-routine').addEventListener('click', () => {
            document.querySelector('.nav-item[data-target="view-log"]').click();
            openWorkoutForm(t.workoutKind || 'pt', t.exercises, t);
        });
        
        listEl.appendChild(el);
    });
}

function setupEventListeners() {
    document.getElementById('btn-freeform').addEventListener('click', () => openWorkoutForm('pt', []));
    document.getElementById('btn-other').addEventListener('click', () => openWorkoutForm('other', []));
    document.getElementById('neck-summary-card').addEventListener('click', () => {
        const routineF = templatesList.find(template => template.id === 't6');
        if (!routineF) {
            showToast('Routine F is unavailable.');
            return;
        }
        document.querySelector('.nav-item[data-target="view-log"]').click();
        openWorkoutForm('neck', routineF.exercises, routineF);
    });
    let newRoutineExercises = [];

    document.getElementById('btn-create-routine').addEventListener('click', () => {
        document.getElementById('new-routine-name').value = '';
        document.getElementById('new-routine-desc').value = '';
        newRoutineExercises = [];
        renderNewRoutineExercises();
        
        // Populate select
        const select = document.getElementById('new-routine-exercise-select');
        select.innerHTML = '<option value="">-- Select Exercise --</option>';
        Object.values(exercisesMap).sort((a, b) => a.name.localeCompare(b.name)).forEach(ex => {
            const opt = document.createElement('option');
            opt.value = ex.id;
            opt.textContent = ex.name;
            select.appendChild(opt);
        });
        
        document.getElementById('create-routine-modal').classList.remove('hidden');
    });

    document.getElementById('btn-close-create-routine').addEventListener('click', () => {
        document.getElementById('create-routine-modal').classList.add('hidden');
    });

    document.getElementById('btn-add-routine-ex').addEventListener('click', () => {
        const select = document.getElementById('new-routine-exercise-select');
        if (select.value) {
            newRoutineExercises.push({
                id: select.value,
                defaultSets: 3,
                defaultReps: ''
            });
            renderNewRoutineExercises();
        }
    });

    function renderNewRoutineExercises() {
        const container = document.getElementById('new-routine-exercises');
        container.innerHTML = '';
        newRoutineExercises.forEach((exObj, idx) => {
            const ex = exercisesMap[exObj.id];
            const el = document.createElement('div');
            el.className = 'form-exercise';
            el.innerHTML = `
                <div class="form-exercise-header">
                    <span class="form-exercise-title">${ex.name}</span>
                    <button class="remove-btn" data-idx="${idx}">&times;</button>
                </div>
                <div class="form-exercise-inputs">
                    <input type="text" placeholder="Sets" value="${exObj.defaultSets}" data-field="defaultSets" data-idx="${idx}">
                    <input type="text" placeholder="Reps" value="${exObj.defaultReps}" data-field="defaultReps" data-idx="${idx}">
                </div>
            `;
            el.querySelector('.remove-btn').addEventListener('click', () => {
                newRoutineExercises.splice(idx, 1);
                renderNewRoutineExercises();
            });
            el.querySelectorAll('input').forEach(inp => {
                inp.addEventListener('input', (e) => {
                    const i = e.target.getAttribute('data-idx');
                    const field = e.target.getAttribute('data-field');
                    newRoutineExercises[i][field] = e.target.value;
                });
            });
            container.appendChild(el);
        });
    }

    document.getElementById('btn-save-routine').addEventListener('click', async () => {
        const name = document.getElementById('new-routine-name').value.trim();
        const desc = document.getElementById('new-routine-desc').value.trim();
        if (!name || newRoutineExercises.length === 0) {
            showToast('Please provide a name and at least one exercise.');
            return;
        }
        
        const newTemplate = {
            id: 't_' + Date.now(),
            name: name,
            description: desc,
            exercises: newRoutineExercises
        };
        
        await put('templates', newTemplate);
        templatesList.push(newTemplate);
        
        renderRoutinesTab();
        renderTemplates(); // updates Quick Log panel
        
        document.getElementById('create-routine-modal').classList.add('hidden');
        showToast('Routine created!');
    });
    
    document.getElementById('btn-back-log').addEventListener('click', closeWorkoutForm);
    document.getElementById('btn-save-workout').addEventListener('click', saveWorkout);
    
    document.getElementById('btn-add-exercise').addEventListener('click', () => {
        const sel = document.getElementById('exercise-select');
        if (sel.value) {
            addExerciseToForm(sel.value, 3, '');
        }
    });

    document.getElementById('btn-modal-add-exercise').addEventListener('click', () => {
        const sel = document.getElementById('workout-modal-exercise-select');
        if (sel.value) addExerciseToModalForm(sel.value);
    });

    document.getElementById('workout-date-select').addEventListener('change', (e) => {
        if (e.target.value === 'other') {
            document.getElementById('workout-date-custom').classList.remove('hidden');
        } else {
            document.getElementById('workout-date-custom').classList.add('hidden');
        }
    });

    document.getElementById('btn-close-exercise-modal').addEventListener('click', () => {
        document.getElementById('exercise-modal').classList.add('hidden');
    });

    document.getElementById('btn-close-category-modal').addEventListener('click', () => {
        document.getElementById('category-modal').classList.add('hidden');
    });
    
    document.getElementById('btn-save-new-ex').addEventListener('click', async () => {
        const nameInput = document.getElementById('new-ex-name');
        const name = nameInput.value.trim();
        if (!name) return;
        
        const cat = document.getElementById('category-modal').getAttribute('data-cat');
        const type = document.getElementById('category-modal').getAttribute('data-type');
        
        const newEx = {
            id: 'e_' + Date.now(),
            name: name,
            categories: [cat],
            type: type,
            instructions: ''
        };
        
        await put('exercises', newEx);
        exercisesMap[newEx.id] = newEx;
        nameInput.value = '';
        
        // Re-render the modal list
        openCategoryModal(cat, type);
        showToast('Exercise added!');
    });
    
    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
            e.target.classList.add('active');
            renderHistory(e.target.getAttribute('data-filter'));
        });
    });
}

function openCategoryModal(cat, type) {
    const modal = document.getElementById('category-modal');
    modal.setAttribute('data-cat', cat);
    modal.setAttribute('data-type', type);
    
    document.getElementById('category-modal-title').textContent = `${cat} (${type === 'stretch' ? 'Stretch' : 'Load'})`;
    
    const listEl = document.getElementById('category-modal-list');
    listEl.innerHTML = '';
    
    // Find matching exercises
    const matches = Object.values(exercisesMap).filter(ex => 
        categoryLinks(ex).some(link => link.category === cat && link.type === type)
    );
    
    if (matches.length === 0) {
        listEl.innerHTML = '<p class="text-muted">No exercises found.</p>';
    } else {
        matches.forEach(ex => {
            const exEl = document.createElement('div');
            exEl.className = 'exercise-item';
            exEl.innerHTML = `
                <div class="template-title">${ex.name}</div>
                <button class="btn btn-secondary btn-sm mt-2 w-100">Log this</button>
            `;
            exEl.querySelector('button').addEventListener('click', () => {
                modal.classList.add('hidden');
                document.querySelector('.nav-item[data-target="view-log"]').click();
                openWorkoutForm('pt', [{ id: ex.id, defaultSets: 3, defaultReps: '' }]);
            });
            listEl.appendChild(exEl);
        });
    }
    
    modal.classList.remove('hidden');
}

function openWorkoutForm(kind, initialExercises = [], routine = null) {
    currentWorkoutForm.kind = kind;
    currentWorkoutForm.entries = [];
    currentWorkoutForm.notes = '';
    currentWorkoutForm.routineId = routine?.id || null;
    currentWorkoutForm.routineName = routine?.name || null;
    
    document.getElementById('log-selection').classList.add('hidden');
    document.getElementById('workout-form-container').classList.remove('hidden');
    document.getElementById('workout-notes').value = '';
    document.getElementById('workout-form-exercises').innerHTML = '';
    
    // Reset date selection
    document.getElementById('workout-date-select').value = 'today';
    document.getElementById('workout-date-custom').classList.add('hidden');
    const todayStr = new Date().toLocaleDateString('en-CA'); // YYYY-MM-DD
    document.getElementById('workout-date-custom').value = todayStr;
    
    const isChecklist = initialExercises.some(ex => ex.checklist);
    let title = isChecklist ? "Session D Reformer Checklist" : "Log Session";
    if (kind === 'neck') title = "Routine F - Neck";
    if (kind === 'other') title = "Other Workout";
    document.getElementById('workout-form-title').textContent = title;
    
    // Populate select
    populateExerciseSelect(document.getElementById('exercise-select'));
    
    if (kind === 'neck' || isChecklist) {
        document.getElementById('add-exercise-group').classList.add('hidden');
    } else {
        document.getElementById('add-exercise-group').classList.remove('hidden');
    }
    
    initialExercises.forEach(exObj => {
        addExerciseToForm(exObj.id, exObj.defaultSets || (exObj.checklist ? '' : 3), exObj.defaultReps || '', exObj.checklist || false);
    });
}

function closeWorkoutForm() {
    document.getElementById('workout-form-container').classList.add('hidden');
    document.getElementById('log-selection').classList.remove('hidden');
}

function addExerciseToForm(exerciseId, defaultSets, defaultReps, checklist = false) {
    const ex = exercisesMap[exerciseId];
    if (!ex) return;
    
    const entryId = 'entry_' + Date.now() + Math.random().toString(36).substr(2, 5);
    currentWorkoutForm.entries.push({
        entryId,
        exercise_id: exerciseId,
        sets: defaultSets,
        reps: defaultReps,
        weight: '',
        exercise_notes: '',
        checklist,
        checked: false
    });
    
    renderWorkoutFormExercises();
}

function removeExerciseFromForm(entryId) {
    currentWorkoutForm.entries = currentWorkoutForm.entries.filter(e => e.entryId !== entryId);
    renderWorkoutFormExercises();
}

function renderWorkoutFormExercises() {
    const container = document.getElementById('workout-form-exercises');
    container.innerHTML = '';
    
    currentWorkoutForm.entries.forEach(entry => {
        const ex = exercisesMap[entry.exercise_id];
        const el = document.createElement('div');
        el.className = entry.checklist ? 'checklist-exercise' : 'form-exercise';

        if (entry.checklist) {
            el.innerHTML = `
                <label class="checklist-label">
                    <input type="checkbox" ${entry.checked ? 'checked' : ''}>
                    <span><strong>${ex.name}</strong><span class="category-hint">${formatCategoryTags(ex)}</span></span>
                </label>
            `;
            el.querySelector('input').addEventListener('change', e => { entry.checked = e.target.checked; });
            container.appendChild(el);
            return;
        }
        
        el.innerHTML = `
            <div class="form-exercise-header">
                <span class="form-exercise-title">${ex.name}</span>
                <button class="remove-btn" data-id="${entry.entryId}">&times;</button>
            </div>
            <div class="form-exercise-inputs">
                <input type="text" placeholder="Sets" value="${entry.sets}" data-field="sets" data-id="${entry.entryId}">
                <input type="text" placeholder="Reps/Time" value="${entry.reps}" data-field="reps" data-id="${entry.entryId}">
                <input type="text" placeholder="Weight/Band" value="${entry.weight}" data-field="weight" data-id="${entry.entryId}" style="grid-column: span 2;">
                <input type="text" placeholder="Exercise Details (e.g. Bench Press)" value="${entry.exercise_notes || ''}" data-field="exercise_notes" data-id="${entry.entryId}" style="grid-column: span 2;">
            </div>
        `;
        
        el.querySelector('.remove-btn').addEventListener('click', () => removeExerciseFromForm(entry.entryId));
        
        el.querySelectorAll('input').forEach(inp => {
            inp.addEventListener('input', (e) => {
                const id = e.target.getAttribute('data-id');
                const field = e.target.getAttribute('data-field');
                const ent = currentWorkoutForm.entries.find(x => x.entryId === id);
                if (ent) ent[field] = e.target.value;
            });
        });
        
        container.appendChild(el);
    });
}

async function saveWorkout() {
    const checklistMode = currentWorkoutForm.entries.some(entry => entry.checklist);
    const entriesToSave = checklistMode
        ? currentWorkoutForm.entries.filter(entry => entry.checked).map(({ checked, checklist, ...entry }) => entry)
        : currentWorkoutForm.entries;

    if (entriesToSave.length === 0 && currentWorkoutForm.kind !== 'other') {
        showToast(checklistMode ? 'Please check at least one exercise.' : 'Please add at least one exercise.');
        return;
    }
    
    const notes = document.getElementById('workout-notes').value;
    
    let workoutTimestamp = Date.now();
    const dateSelect = document.getElementById('workout-date-select').value;
    
    if (dateSelect === 'yesterday') {
        workoutTimestamp -= 24 * 60 * 60 * 1000;
    } else if (dateSelect === 'other') {
        const customDate = document.getElementById('workout-date-custom').value;
        if (customDate) {
            const [y, m, d] = customDate.split('-');
            workoutTimestamp = new Date(y, m - 1, d, 12, 0, 0).getTime();
        }
    }
    
    const log = {
        id: 'log_' + Date.now(),
        date: workoutTimestamp,
        workout_kind: currentWorkoutForm.kind,
        entries: entriesToSave,
        notes: notes,
        routine_id: currentWorkoutForm.routineId || null,
        routine_name: currentWorkoutForm.routineName || null
    };
    
    await put('workout_logs', log);
    workoutLogs.push(log);
    workoutLogs.sort((a, b) => b.date - a.date); // Resort after inserting in case of past dates
    
    showToast('Workout saved!');
    closeWorkoutForm();
    
    // Nav back to dashboard
    document.querySelector('.nav-item[data-target="view-dashboard"]').click();
}

// --- History ---
function renderHistory(filter) {
    if (filter) historyFilter = filter;
    const listEl = document.getElementById('history-list');
    listEl.innerHTML = '';
    
    // Muscle Group Tracker Logic
    const targetMuscleGroups = ["Chest", "Shoulders", "Biceps", "Triceps", "Quads", "Glutes", "Hamstrings"];
    const lastLogged = {};
    targetMuscleGroups.forEach(m => lastLogged[m] = 0);
    
    workoutLogs.forEach(log => {
        log.entries.forEach(entry => {
            const ex = exercisesMap[entry.exercise_id];
            if (ex) muscleGroups(ex).forEach(group => {
                if (group in lastLogged && log.date > lastLogged[group]) lastLogged[group] = log.date;
            });
        });
    });
    
    const trackerEl = document.getElementById('muscle-group-tracker');
    if (trackerEl) {
        trackerEl.innerHTML = '';
        const now = Date.now();
        const msInDay = 24 * 60 * 60 * 1000;
        
        targetMuscleGroups.forEach(m => {
            const ts = lastLogged[m];
            const daysAgo = ts === 0 ? Infinity : Math.floor((now - ts) / msInDay);
            
            const card = document.createElement('div');
            card.className = 'muscle-card';
            if (daysAgo < 7) card.classList.add('status-green');
            else if (daysAgo <= 10) card.classList.add('status-yellow');
            else card.classList.add('status-red');
            
            card.innerHTML = `
                <div class="muscle-name">${m}</div>
                <div class="muscle-days">${ts === 0 ? '-' : daysAgo + 'd'}</div>
            `;
            trackerEl.appendChild(card);
        });
    }

    const filtered = workoutLogs.filter(log => historyFilter === 'all' || log.workout_kind === historyFilter);
    
    if (filtered.length === 0) {
        listEl.innerHTML = '<p class="text-muted">No workouts found.</p>';
        return;
    }
    
    filtered.forEach(log => {
        const el = document.createElement('div');
        el.className = 'log-item log-item-selectable';
        
        const dateStr = new Date(log.date).toLocaleString([], { weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
        
        const title = getLogTitle(log);

        const badge = getRoutineBadge(log.routine_id, log.routine_name);
        const badgeHtml = badge ? `<span class="routine-badge" style="background-color:${badge.color}">${badge.letter}</span>` : '';
        
        let entriesHtml = log.entries.map(ent => {
            const ex = exercisesMap[ent.exercise_id];
            const hasPrescription = ent.sets !== '' && ent.sets != null && ent.reps !== '' && ent.reps != null;
            let details = `<li>${ex ? ex.name : 'Unknown'}${hasPrescription ? ` - ${ent.sets} sets x ${ent.reps}` : ''}${ent.weight ? ' ('+ent.weight+')' : ''}`;
            if (ent.exercise_notes) {
                details += `<br><span style="color:var(--text-secondary);font-size:12px;margin-left:8px;">↳ ${ent.exercise_notes}</span>`;
            }
            details += `</li>`;
            return details;
        }).join('');
        
        el.innerHTML = `
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 8px; gap:8px;">
                <span class="template-title" style="display:flex; align-items:center; gap:8px; min-width:0;">${badgeHtml}<span>${title}</span></span>
                <span class="text-muted" style="font-size:12px; flex-shrink:0;">${dateStr}</span>
            </div>
            ${entriesHtml ? `<ul style="font-size:13px; margin-left:16px; margin-bottom:8px; color:var(--text-primary); list-style-type:circle;">${entriesHtml}</ul>` : '<p class="text-muted" style="font-size:13px;">No exercises logged.</p>'}
            ${log.notes ? `<div style="font-size:13px; font-style:italic; border-top: 1px solid var(--border-color); padding-top:4px;">"${log.notes}"</div>` : ''}
            <div class="log-item-hint">Tap for details · edit · delete</div>
        `;
        
        el.setAttribute('role', 'button');
        el.setAttribute('tabindex', '0');
        el.setAttribute('aria-label', `${title} - ${dateStr}. Tap for details, edit, or delete.`);
        el.addEventListener('click', () => openWorkoutModal(log.id));
        el.addEventListener('keydown', (event) => {
            if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                openWorkoutModal(log.id);
            }
        });
        
        listEl.appendChild(el);
    });
}

// --- History: Workout Detail / Edit / Delete ---
function getLogTitle(log) {
    if (log.workout_kind === 'neck') return 'Neck Routine';
    if (log.workout_kind === 'other') return 'Other Workout';
    return 'Workout Session';
}

function formatLogDate(ts) {
    return new Date(ts).toLocaleString([], { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

// Populate an exercise <select> with all exercises: muscle-group
// placeholders first, then the rest alphabetically.
function populateExerciseSelect(selectEl) {
    selectEl.innerHTML = '<option value="">-- Select Exercise --</option>';
    
    const targetMuscleGroups = ["Chest", "Shoulders", "Biceps", "Triceps", "Quads", "Glutes", "Hamstrings"];
    let allExercises = Object.values(exercisesMap);
    
    let placeholders = allExercises.filter(ex => targetMuscleGroups.includes(ex.name));
    let others = allExercises.filter(ex => !targetMuscleGroups.includes(ex.name));
    
    placeholders.sort((a, b) => targetMuscleGroups.indexOf(a.name) - targetMuscleGroups.indexOf(b.name));
    others.sort((a, b) => a.name.localeCompare(b.name));
    
    [...placeholders, ...others].forEach(ex => {
        const opt = document.createElement('option');
        opt.value = ex.id;
        opt.textContent = ex.name;
        selectEl.appendChild(opt);
    });
}

function openWorkoutModal(logId) {
    const log = workoutLogs.find(l => l.id === logId);
    if (!log) return;
    modalLogId = logId;
    renderWorkoutModalView(log);
    document.getElementById('workout-modal').classList.remove('hidden');
}

function closeWorkoutModal() {
    document.getElementById('workout-modal').classList.add('hidden');
    modalLogId = null;
    modalEditEntries = [];
}

function renderWorkoutModalView(log) {
    document.getElementById('workout-modal-title').textContent = getLogTitle(log);
    
    const badge = getRoutineBadge(log.routine_id, log.routine_name);
    const subtitleText = [formatLogDate(log.date), log.routine_name].filter(Boolean).join('  ·  ');
    const badgeHtml = badge
        ? `<span class="routine-badge" style="background-color:${badge.color}; margin-right:6px; vertical-align:middle;">${badge.letter}</span>`
        : '';
    document.getElementById('workout-modal-subtitle').innerHTML = `${badgeHtml}${escapeHtml(subtitleText)}`;
    
    const entriesView = document.getElementById('workout-modal-entries-view');
    entriesView.innerHTML = '';
    
    if (log.entries.length === 0) {
        entriesView.innerHTML = '<p class="text-muted">No exercises logged for this workout.</p>';
    } else {
        log.entries.forEach(ent => {
            const ex = exercisesMap[ent.exercise_id];
            const hasPrescription = ent.sets !== '' && ent.sets != null && ent.reps !== '' && ent.reps != null;
            const meta = [
                hasPrescription ? `${escapeHtml(ent.sets)} sets × ${escapeHtml(ent.reps)}` : '',
                ent.weight ? escapeHtml(ent.weight) : ''
            ].filter(Boolean).join('  ·  ');
            const tags = ex ? formatCategoryTags(ex) : '';
            
            const row = document.createElement('div');
            row.className = 'form-exercise';
            row.innerHTML = `
                <div class="form-exercise-title">
                    ${ex ? escapeHtml(ex.name) : 'Unknown exercise'}
                    ${tags ? `<span class="category-hint">${escapeHtml(tags)}</span>` : ''}
                </div>
                ${meta ? `<div class="workout-entry-meta">${meta}</div>` : ''}
                ${ent.exercise_notes ? `<div class="workout-entry-note">↳ ${escapeHtml(ent.exercise_notes)}</div>` : ''}
            `;
            entriesView.appendChild(row);
        });
    }
    
    const notesView = document.getElementById('workout-modal-notes-view');
    if (log.notes) {
        notesView.classList.remove('hidden');
        notesView.innerHTML = `
            <label>Pain/Discomfort Notes</label>
            <div class="workout-notes-quote">"${escapeHtml(log.notes)}"</div>
        `;
    } else {
        notesView.classList.add('hidden');
        notesView.innerHTML = '';
    }
    
    document.getElementById('workout-modal-view').classList.remove('hidden');
    document.getElementById('workout-modal-edit').classList.add('hidden');
    renderWorkoutModalActions('view');
}

function startWorkoutEdit(log) {
    modalEditEntries = log.entries.map(ent => ({
        entryId: ent.entryId || 'entry_' + Date.now() + Math.random().toString(36).substr(2, 5),
        exercise_id: ent.exercise_id,
        sets: ent.sets ?? '',
        reps: ent.reps ?? '',
        weight: ent.weight ?? '',
        exercise_notes: ent.exercise_notes ?? ''
    }));
    
    const d = new Date(log.date);
    document.getElementById('workout-modal-date').value = d.toLocaleDateString('en-CA');
    document.getElementById('workout-modal-time').value =
        `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
    document.getElementById('workout-modal-notes').value = log.notes || '';
    
    populateExerciseSelect(document.getElementById('workout-modal-exercise-select'));
    renderWorkoutModalExercises();
    
    document.getElementById('workout-modal-view').classList.add('hidden');
    document.getElementById('workout-modal-edit').classList.remove('hidden');
    renderWorkoutModalActions('edit');
}

function renderWorkoutModalExercises() {
    const container = document.getElementById('workout-modal-entries-edit');
    container.innerHTML = '';
    
    if (modalEditEntries.length === 0) {
        container.innerHTML = '<p class="text-muted mb-4">No exercises yet. Add one below.</p>';
        return;
    }
    
    modalEditEntries.forEach(entry => {
        const ex = exercisesMap[entry.exercise_id];
        const el = document.createElement('div');
        el.className = 'form-exercise';
        el.innerHTML = `
            <div class="form-exercise-header">
                <span class="form-exercise-title">${ex ? escapeHtml(ex.name) : 'Unknown exercise'}</span>
                <button class="remove-btn" type="button" data-id="${entry.entryId}">&times;</button>
            </div>
            <div class="form-exercise-inputs">
                <input type="text" placeholder="Sets" value="${escapeHtml(entry.sets)}" data-field="sets" data-id="${entry.entryId}">
                <input type="text" placeholder="Reps/Time" value="${escapeHtml(entry.reps)}" data-field="reps" data-id="${entry.entryId}">
                <input type="text" placeholder="Weight/Band" value="${escapeHtml(entry.weight)}" data-field="weight" data-id="${entry.entryId}" style="grid-column: span 2;">
                <input type="text" placeholder="Exercise Details (e.g. Bench Press)" value="${escapeHtml(entry.exercise_notes)}" data-field="exercise_notes" data-id="${entry.entryId}" style="grid-column: span 2;">
            </div>
        `;
        
        el.querySelector('.remove-btn').addEventListener('click', () => {
            modalEditEntries = modalEditEntries.filter(e => e.entryId !== entry.entryId);
            renderWorkoutModalExercises();
        });
        
        el.querySelectorAll('input').forEach(inp => {
            inp.addEventListener('input', (e) => {
                const ent = modalEditEntries.find(x => x.entryId === e.target.getAttribute('data-id'));
                if (ent) ent[e.target.getAttribute('data-field')] = e.target.value;
            });
        });
        
        container.appendChild(el);
    });
}

function addExerciseToModalForm(exerciseId) {
    const ex = exercisesMap[exerciseId];
    if (!ex) return;
    modalEditEntries.push({
        entryId: 'entry_' + Date.now() + Math.random().toString(36).substr(2, 5),
        exercise_id: exerciseId,
        sets: 3,
        reps: '',
        weight: '',
        exercise_notes: ''
    });
    renderWorkoutModalExercises();
}

function renderWorkoutModalActions(mode) {
    const actions = document.getElementById('workout-modal-actions');
    actions.innerHTML = '';
    
    const mkBtn = (className, text) => {
        const btn = document.createElement('button');
        btn.className = className;
        btn.type = 'button';
        btn.textContent = text;
        actions.appendChild(btn);
        return btn;
    };
    
    if (mode === 'view') {
        mkBtn('btn btn-primary w-100', 'Edit Workout').addEventListener('click', () => {
            const log = workoutLogs.find(l => l.id === modalLogId);
            if (log) startWorkoutEdit(log);
        });
        mkBtn('btn btn-danger w-100 mt-2', 'Delete Workout').addEventListener('click', () => deleteWorkout(modalLogId));
        mkBtn('btn btn-secondary w-100 mt-2', 'Close').addEventListener('click', closeWorkoutModal);
    } else {
        mkBtn('btn btn-primary w-100', 'Save Changes').addEventListener('click', saveWorkoutFromModal);
        mkBtn('btn btn-secondary w-100 mt-2', 'Cancel').addEventListener('click', () => {
            const log = workoutLogs.find(l => l.id === modalLogId);
            if (log) renderWorkoutModalView(log);
        });
    }
}

async function saveWorkoutFromModal() {
    const log = workoutLogs.find(l => l.id === modalLogId);
    if (!log) return;
    
    if (modalEditEntries.length === 0 && log.workout_kind !== 'other') {
        showToast('Please add at least one exercise.');
        return;
    }
    
    let date = log.date;
    const dateValue = document.getElementById('workout-modal-date').value;
    if (dateValue) {
        const [y, m, d] = dateValue.split('-');
        const timeValue = document.getElementById('workout-modal-time').value;
        const [hh, mm] = timeValue ? timeValue.split(':').map(Number) : [0, 0];
        date = new Date(y, m - 1, d, hh || 0, mm || 0, 0).getTime();
    }
    
    const updated = {
        ...log,
        date,
        entries: modalEditEntries.map(e => ({ ...e })),
        notes: document.getElementById('workout-modal-notes').value
    };
    
    try {
        await put('workout_logs', updated);
    } catch (err) {
        console.error(err);
        showToast('Could not save changes. Please try again.');
        return;
    }
    
    const idx = workoutLogs.findIndex(l => l.id === updated.id);
    if (idx !== -1) workoutLogs[idx] = updated;
    else workoutLogs.push(updated);
    workoutLogs.sort((a, b) => b.date - a.date);
    
    closeWorkoutModal();
    renderHistory();
    renderDashboard();
    showToast('Workout updated!');
}

async function deleteWorkout(logId) {
    const log = workoutLogs.find(l => l.id === logId);
    if (!log) return;
    
    if (!window.confirm('Delete this workout? This cannot be undone.')) return;
    
    try {
        await remove('workout_logs', logId);
    } catch (err) {
        console.error(err);
        showToast('Could not delete workout. Please try again.');
        return;
    }
    
    workoutLogs = workoutLogs.filter(l => l.id !== logId);
    closeWorkoutModal();
    renderHistory();
    renderDashboard();
    showToast('Workout deleted.');
}

// --- Utils ---
function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, ch => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[ch]));
}

function formatCategoryTags(exercise) {
    return [...categoryLinks(exercise).map(link => `${link.category} · ${link.type === 'stretch' ? 'Stretch' : 'Load'}`), ...muscleGroups(exercise)].join(' / ');
}

function showToast(msg) {
    const toast = document.getElementById('toast');
    toast.textContent = msg;
    toast.classList.remove('hidden');
    setTimeout(() => {
        toast.classList.add('hidden');
    }, 3000);
}
