// HTTP-backed DB client. Keeps the original exported function names/signatures
// so app.js/editor.js/seed.js can continue to call db.js like the IndexedDB wrapper.

const API_BASE = './api';
const STORES = new Set(['exercises', 'templates', 'workout_logs']);

function assertStore(storeName) {
    if (!STORES.has(storeName)) throw new Error(`Unknown store: ${storeName}`);
}

async function request(path, options = {}) {
    const response = await fetch(`${API_BASE}${path}`, {
        cache: 'no-store',
        headers: {
            ...(options.body ? { 'Content-Type': 'application/json' } : {}),
            ...options.headers
        },
        ...options
    });

    if (!response.ok) {
        let message = `${response.status} ${response.statusText}`;
        try {
            const payload = await response.json();
            if (payload.error) message = payload.error;
        } catch (_) {}
        throw new Error(message);
    }

    if (response.status === 204) return undefined;
    return response.json();
}

export async function initDB() {
    await request('/health');
    return true;
}

export async function getAll(storeName) {
    assertStore(storeName);
    return request(`/${storeName}`);
}

export async function get(storeName, id) {
    assertStore(storeName);
    try {
        return await request(`/${storeName}/${encodeURIComponent(id)}`);
    } catch (error) {
        if (/404|not found/i.test(error.message)) return undefined;
        throw error;
    }
}

export async function put(storeName, item) {
    assertStore(storeName);
    if (!item?.id) throw new Error('Item must have an id');
    const result = await request(`/${storeName}/${encodeURIComponent(item.id)}`, {
        method: 'PUT',
        body: JSON.stringify(item)
    });
    return result.id;
}

export async function remove(storeName, id) {
    assertStore(storeName);
    await request(`/${storeName}/${encodeURIComponent(id)}`, { method: 'DELETE' });
}

export async function putAll(storeName, items) {
    assertStore(storeName);
    await request(`/${storeName}/bulk`, {
        method: 'POST',
        body: JSON.stringify(items)
    });
}

// Commit the exercise and its routine memberships together on the server.
export async function saveExerciseAndTemplates(exercise, templates) {
    await request('/save-exercise-and-templates', {
        method: 'POST',
        body: JSON.stringify({ exercise, templates })
    });
}

// Delete an exercise and remove it from every routine atomically.
export async function deleteExerciseCascade(id) {
    await request('/admin/delete-exercise', {
        method: 'POST',
        body: JSON.stringify({ id })
    });
}
