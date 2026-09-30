import { getAll, saveExerciseAndTemplates } from './db.js';
import { CATEGORIES } from './seed.js';
const MUSCLES = ['Chest', 'Shoulders', 'Biceps', 'Triceps', 'Quads', 'Glutes', 'Hamstrings'];
export function categoryLinks(ex) {
    return ex.categoryLinks ?? (ex.categories || []).filter(category => CATEGORIES.includes(category) && ['stretch', 'load'].includes(ex.type)).map(category => ({ category, type: ex.type }));
}
export function muscleGroups(ex) {
    return ex.muscleGroups ?? (MUSCLES.includes(ex.name) ? [ex.name] : []);
}
export function setupExerciseEditor(onSaved) {
    const dialog = document.createElement('dialog');
    dialog.className = 'exercise-editor';
    dialog.innerHTML = `
        <form method="dialog" id="editor-form">
            <h2>Exercise Editor</h2>
            <p class="text-muted mb-4">Changes are saved to the shared server. Category edits also update how past logs are counted.</p>
            <label>Choose an exercise<select id="editor-select"></select></label>
            <button type="button" id="editor-new" class="btn btn-secondary mt-2 mb-4">Add New Exercise</button>
            <label>Exercise name<input id="editor-name" required maxlength="120"></label>
            <label>Instructions<textarea id="editor-instructions" rows="2"></textarea></label>
            <fieldset><legend>PT categories</legend><div id="editor-categories"></div></fieldset>
            <fieldset><legend>Muscle groups</legend><div id="editor-muscles"></div></fieldset>
            <fieldset><legend>Include in routines</legend><div id="editor-routines"></div></fieldset>
            <p id="editor-error" role="alert"></p>
            <div class="editor-actions"><button type="button" id="editor-cancel" class="btn btn-secondary">Cancel</button><button type="submit" class="btn btn-primary" id="editor-save">Save Changes</button></div>
        </form>`;
    document.body.append(dialog);
    const q = selector => dialog.querySelector(selector);
    let exercises = [], templates = [], selected = null, dirty = false;
    const check = (parent, text, checked = false) => {
        const label = document.createElement('label');
        label.className = 'editor-check';
        const input = document.createElement('input');
        input.type = 'checkbox'; input.checked = checked;
        label.append(input, document.createTextNode(text)); parent.append(label);
        return input;
    };
    function render(id) {
        selected = exercises.find(ex => ex.id === id) || null;
        q('#editor-select').value = selected?.id || '';
        q('#editor-name').value = selected?.name || '';
        q('#editor-instructions').value = selected?.instructions || '';
        q('#editor-error').textContent = '';
        const links = selected ? categoryLinks(selected) : [];
        const cats = q('#editor-categories'); cats.replaceChildren();
        CATEGORIES.forEach(category => {
            const row = document.createElement('div'); row.className = 'editor-category-row';
            const title = document.createElement('span'); title.textContent = category; row.append(title);
            ['stretch', 'load'].forEach(type => {
                const input = check(row, type === 'stretch' ? 'Stretch' : 'Load', links.some(link => link.category === category && link.type === type));
                input.dataset.category = category; input.dataset.type = type;
            }); cats.append(row);
        });
        const muscles = q('#editor-muscles'); muscles.replaceChildren();
        MUSCLES.forEach(group => { check(muscles, group, selected ? muscleGroups(selected).includes(group) : false).dataset.group = group; });
        const routines = q('#editor-routines'); routines.replaceChildren();
        templates.forEach(template => {
            const member = template.exercises.find(item => item.id === selected?.id);
            const row = document.createElement('div'); row.className = 'editor-routine';
            const input = check(row, template.name, !!member); input.dataset.routine = template.id;
            const fields = document.createElement('div'); fields.className = 'editor-defaults';
            if (template.inputMode === 'checklist') {
                fields.textContent = 'Checklist — no sets or reps';
            } else {
                for (const [field, title, value] of [['defaultSets', 'Sets', member?.defaultSets ?? 3], ['defaultReps', 'Reps / time', member?.defaultReps ?? '10']]) {
                    const label = document.createElement('label'); label.textContent = title;
                    const edit = document.createElement('input'); edit.type = 'text'; edit.value = value; edit.dataset.field = field;
                    label.append(edit); fields.append(label);
                }
            }
            fields.hidden = !input.checked;
            input.addEventListener('change', () => { fields.hidden = !input.checked; });
            row.append(fields); routines.append(row);
        });
        dirty = false;
    }
    const discard = () => !dirty || window.confirm('Discard unsaved exercise changes?');
    q('#editor-select').addEventListener('change', event => {
        if (discard()) render(event.target.value);
        else event.target.value = selected?.id || '';
    });
    q('#editor-new').addEventListener('click', () => { if (discard()) { render(''); q('#editor-name').focus(); } });
    dialog.addEventListener('input', event => { if (event.target.id !== 'editor-select') dirty = true; });
    dialog.addEventListener('cancel', event => { if (!discard()) event.preventDefault(); });
    q('#editor-cancel').addEventListener('click', () => { if (discard()) dialog.close(); });
    document.getElementById('btn-exercise-editor').addEventListener('click', async () => {
        exercises = (await getAll('exercises')).sort((a,b) => a.name.localeCompare(b.name));
        templates = await getAll('templates');
        const select = q('#editor-select'); select.replaceChildren(new Option('— New exercise —', ''));
        exercises.forEach(ex => select.add(new Option(ex.name, ex.id)));
        render(exercises[0]?.id || ''); dialog.showModal();
    });
    q('#editor-form').addEventListener('submit', async event => {
        event.preventDefault();
        const name = q('#editor-name').value.trim();
        if (!name) { q('#editor-error').textContent = 'Enter an exercise name.'; return; }
        // Names are also displayed by the legacy app through HTML templates.
        if (/[<>"&]/.test(name)) { q('#editor-error').textContent = 'Use plain text without <, >, &, or double quotes in the name.'; return; }
        if (exercises.some(ex => ex.id !== selected?.id && ex.name.toLowerCase() === name.toLowerCase())) {
            q('#editor-error').textContent = 'An exercise with this name already exists. Select it from the list.'; return;
        }
        const links = [...q('#editor-categories').querySelectorAll('input:checked')].map(input => ({category: input.dataset.category, type: input.dataset.type}));
        const groups = [...q('#editor-muscles').querySelectorAll('input:checked')].map(input => input.dataset.group);
        const exercise = {...selected, id: selected?.id || `custom_${crypto.randomUUID()}`, name,
            instructions: q('#editor-instructions').value.trim(), categoryLinks: links, muscleGroups: groups,
            categories: [...new Set(links.map(link => link.category))], type: links[0]?.type || 'n/a', userEdited: true};
        const updates = [];
        for (const row of q('#editor-routines').children) {
            const input = row.querySelector('input[type=checkbox]');
            const template = templates.find(t => t.id === input.dataset.routine);
            const old = template.exercises.find(item => item.id === exercise.id);
            if (!input.checked && !old) continue;
            let entries = template.exercises.map(item => ({...item}));
            if (!input.checked) entries = entries.filter(item => item.id !== exercise.id);
            else {
                const member = old ? {...old} : {id: exercise.id};
                if (template.inputMode === 'checklist') member.checklist = true;
                else for (const field of row.querySelectorAll('[data-field]')) {
                    if (/[<>"&]/.test(field.value)) { q('#editor-error').textContent = 'Use plain text for sets and reps.'; return; }
                    member[field.dataset.field] = field.value.trim();
                }
                if (old) entries = entries.map(item => item.id === exercise.id ? member : item);
                else entries.push(member);
            }
            if (JSON.stringify(entries) !== JSON.stringify(template.exercises)) updates.push({...template, exercises: entries, userEdited: true});
        }
        q('#editor-save').disabled = true;
        try {
            await saveExerciseAndTemplates(exercise, updates);
            dirty = false;
            await onSaved(); dialog.close();
        } catch (error) {
            q('#editor-error').textContent = 'Could not finish saving. Please try again.';
        } finally { q('#editor-save').disabled = false; }
    });
}
