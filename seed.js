import { getAll, putAll } from './db.js';

export const CATEGORIES = [
    "Back Flexion", "Back Extension", "Back Side Bending", "Back Rotation",
    "Back Anti-Side Bending", "Back Anti-Rotation", "Back Anti-Extension", "Back Anti-Flexion",
    "Hip Flexion", "Hip Extension", "Hip Abduction", "Hip Adduction",
    "Hamstrings", "Glutes"
];

const SEED_EXERCISES = [
    // Back Flexion
    { id: "e1", name: "Reformer Short Box Round Back", categories: ["Back Flexion"], type: "load", instructions: "" },
    { id: "e2", name: "Standing Banded Crunches", categories: ["Back Flexion"], type: "load", instructions: "" },
    { id: "e3", name: "Cat Pose", categories: ["Back Flexion"], type: "stretch", instructions: "" },
    { id: "e4", name: "Knees-to-Chest", categories: ["Back Flexion"], type: "stretch", instructions: "" },
    
    // Back Extension
    { id: "e5", name: "45° Roman Chair Back Extension", categories: ["Back Extension"], type: "load", instructions: "" },
    { id: "e6", name: "Reformer Swan", categories: ["Back Extension"], type: "load", instructions: "" },
    { id: "e7", name: "Sphinx", categories: ["Back Extension"], type: "stretch", instructions: "" },
    { id: "e8", name: "Supported Cobra", categories: ["Back Extension"], type: "stretch", instructions: "" },

    // Side Bending (Back Side Bending)
    { id: "e9", name: "45° Roman Chair Side Bends", categories: ["Back Side Bending"], type: "load", instructions: "" },
    { id: "e10", name: "Reformer Short Box Side Bends", categories: ["Back Side Bending"], type: "load", instructions: "" },
    { id: "e11", name: "Reformer Mermaid", categories: ["Back Side Bending"], type: "stretch", instructions: "" },
    { id: "e12", name: "Kneeling Lat & QL Reach", categories: ["Back Side Bending"], type: "stretch", instructions: "" },

    // Back Rotation
    { id: "e13", name: "Banded Woodchoppers", categories: ["Back Rotation"], type: "load", instructions: "" },
    { id: "e14", name: "Reformer Seated Torso Twist", categories: ["Back Rotation"], type: "load", instructions: "" },
    { id: "e15", name: "Supine Windshield Wipers", categories: ["Back Rotation"], type: "stretch", instructions: "" },
    { id: "e16", name: "Open-Book Stretch", categories: ["Back Rotation"], type: "stretch", instructions: "" },

    // Anti-Side Bending
    { id: "e17", name: "Farmer's Carry", categories: ["Back Anti-Side Bending"], type: "load", instructions: "" },
    { id: "e18", name: "Side Plank", categories: ["Back Anti-Side Bending"], type: "load", instructions: "" },
    { id: "e19", name: "Bananasana", categories: ["Back Anti-Side Bending"], type: "stretch", instructions: "" },

    // Anti-Rotation
    { id: "e20", name: "Pallof Press", categories: ["Back Anti-Rotation"], type: "load", instructions: "" },
    { id: "e21", name: "Bird Dog with Band", categories: ["Back Anti-Rotation"], type: "load", instructions: "" },
    { id: "e22", name: "Thread the Needle", categories: ["Back Anti-Rotation"], type: "stretch", instructions: "" },

    // Anti-Extension
    { id: "e23", name: "Resisted Deadbugs", categories: ["Back Anti-Extension"], type: "load", instructions: "" },
    { id: "e24", name: "Reformer Long Stretch Plank", categories: ["Back Anti-Extension"], type: "load", instructions: "" },
    { id: "e25", name: "Prone Psoas Stretch", categories: ["Back Anti-Extension"], type: "stretch", instructions: "" },
    { id: "e26", name: "Anterior Chain Reach", categories: ["Back Anti-Extension"], type: "stretch", instructions: "" },

    // Anti-Flexion
    { id: "e27", name: "Kettlebell Goblet Squat", categories: ["Back Anti-Flexion"], type: "load", instructions: "" },
    { id: "e28", name: "Heavy Farmer's Walk", categories: ["Back Anti-Flexion"], type: "load", instructions: "" },
    { id: "e29", name: "Child's Pose (wide knees)", categories: ["Back Anti-Flexion"], type: "stretch", instructions: "" },

    // Hip Flexion
    { id: "e30", name: "Banded Standing Knee Drives", categories: ["Hip Flexion"], type: "load", instructions: "" },
    { id: "e31", name: "Hanging Knee Raises", categories: ["Hip Flexion"], type: "load", instructions: "" },
    { id: "e32", name: "Half-Kneeling Hip Flexor Stretch", categories: ["Hip Flexion"], type: "stretch", instructions: "" },
    { id: "e33", name: "Couch Stretch", categories: ["Hip Flexion"], type: "stretch", instructions: "" },

    // Hip Extension / Hamstrings / Glutes
    { id: "e34", name: "Kettlebell RDL", categories: ["Hip Extension", "Hamstrings"], type: "load", instructions: "" },
    { id: "e35", name: "Single-Leg Hip Thrust", categories: ["Hip Extension", "Glutes"], type: "load", instructions: "" },
    { id: "e36", name: "Roman Chair Hip Extension", categories: ["Hip Extension", "Glutes", "Back Flexion", "Back Extension"], type: "load", instructions: "" },
    { id: "e37", name: "Supine Hamstring Strap Stretch", categories: ["Hip Extension", "Hamstrings"], type: "stretch", instructions: "" },
    { id: "e38", name: "Figure-4 Stretch", categories: ["Hip Extension", "Glutes"], type: "stretch", instructions: "" },
    
    // Hip Abduction
    { id: "e39", name: "Banded Monster Walks", categories: ["Hip Abduction"], type: "load", instructions: "" },
    { id: "e40", name: "Reformer Side Splits", categories: ["Hip Abduction"], type: "load", instructions: "" },
    { id: "e41", name: "Seated Figure-4", categories: ["Hip Abduction"], type: "stretch", instructions: "" },
    { id: "e42", name: "Cross-Body Glute Stretch", categories: ["Hip Abduction"], type: "stretch", instructions: "" },

    // Hip Adduction
    { id: "e43", name: "Modified Copenhagen Plank", categories: ["Hip Adduction"], type: "load", instructions: "" },
    { id: "e44", name: "Reformer Adductor Splits", categories: ["Hip Adduction"], type: "load", instructions: "" },
    { id: "e45", name: "Frog Stretch", categories: ["Hip Adduction"], type: "stretch", instructions: "" },
    { id: "e46", name: "Butterfly Stretch", categories: ["Hip Adduction"], type: "stretch", instructions: "" },

    // Routine F — Neck
    { id: "n1", name: "Doorway Pectoral Stretch", categories: [], type: "stretch", instructions: "2 sets of 30 seconds" },
    { id: "n2", name: "Upper Trapezius Stretch", categories: [], type: "stretch", instructions: "30 seconds each side" },
    { id: "n3", name: "Chin Tucks", categories: [], type: "load", instructions: "2 sets of 10" },
    { id: "n4", name: "Resistance Band Rows", categories: [], type: "load", instructions: "3 sets of 10" },
    { id: "n5", name: "Wall Slides", categories: [], type: "load", instructions: "2 sets of 10" },
    { id: "n6", name: "Prone Y Raises", categories: [], type: "load", instructions: "2 sets of 10" },

    // Session E specific
    { id: "e47", name: "Segmental Cat-Cow", categories: ["Back Flexion", "Back Extension"], type: "n/a", instructions: "Mobility (unloaded)" },
    { id: "e48", name: "Deadbug with 3-Second Exhale Hold", categories: ["Back Anti-Extension", "Hip Flexion"], type: "load", instructions: "" },
    { id: "e49", name: "Side Plank with Clamshell / Leg Raise", categories: ["Back Anti-Side Bending", "Hip Abduction"], type: "load", instructions: "" },
    { id: "e50", name: "Single-Leg Glute Bridge / B-Stance Bridge", categories: ["Hip Extension", "Glutes"], type: "load", instructions: "" },
    { id: "e51", name: "Bodyweight Hinge / \"Good Morning\"", categories: ["Back Anti-Flexion", "Hamstrings"], type: "load", instructions: "Hands behind head" },
    { id: "e52", name: "Half-Kneeling Hip Flexor / Psoas Reach", categories: ["Hip Flexion"], type: "stretch", instructions: "Squeeze trailing glute" },

    // Other Generic
    { id: "o1", name: "Treadmill Walking", categories: [], type: "n/a", instructions: "" },
    { id: "o2", name: "Stationary Bike", categories: [], type: "n/a", instructions: "" },

    // Muscle Groups (Other Workouts)
    { id: "m1", name: "Chest", categories: [], type: "n/a", instructions: "" },
    { id: "m2", name: "Shoulders", categories: [], type: "n/a", instructions: "" },
    { id: "m3", name: "Biceps", categories: [], type: "n/a", instructions: "" },
    { id: "m4", name: "Triceps", categories: [], type: "n/a", instructions: "" },
    { id: "m5", name: "Quads", categories: [], type: "n/a", instructions: "" },
    { id: "m6", name: "Glutes", categories: [], type: "n/a", instructions: "" },
    { id: "m7", name: "Hamstrings", categories: [], type: "n/a", instructions: "" }
];

export const REFORMER_EXERCISES = [
    ["Footwork (rounded spine / scoop)", "Back Flexion", "stretch"], ["Pelvic Tilt (on carriage)", "Back Flexion", "stretch"], ["Chest Expansion (rounded)", "Back Flexion", "stretch"],
    ["Hundreds (rounded)", "Back Flexion", "load"], ["Abdominal / Mid-Back Series", "Back Flexion", "load"], ["Teaser (on Reformer)", "Back Flexion", "load"],
    ["Swan (mobility)", "Back Extension", "stretch"], ["Mermaid (extension phase)", "Back Extension", "stretch"], ["Chest Expansion (neutral / extended)", "Back Extension", "stretch"],
    ["Swan (loaded with straps / springs)", "Back Extension", "load"], ["Long Box Series (extension)", "Back Extension", "load"], ["Elephant (extension phase)", "Back Extension", "load"],
    ["Mermaid (rotation phase)", "Back Rotation", "stretch"], ["Seated Rotation (passive)", "Back Rotation", "stretch"], ["Seated Rotation with Straps", "Back Rotation", "load"], ["Side-Lying Rotation", "Back Rotation", "load"],
    ["Mermaid (lateral flexion phase)", "Back Side Bending", "stretch"], ["Side Stretch (on Box)", "Back Side Bending", "stretch"], ["Side Plank with Lateral Spine Tilt", "Back Side Bending", "load"], ["Side Leg Press with Lateral Spine Tilt", "Back Side Bending", "load"],
    ["Kneeling Hip Flexor Stretch", "Hip Extension", "stretch"], ["Lunge (on Reformer)", "Hip Extension", "stretch"], ["Footwork / Leg Press", "Hip Extension", "load"], ["Glute Bridge (on Reformer)", "Hip Extension", "load"], ["Single-Leg Press", "Hip Extension", "load"],
    ["Modified Child's Pose", "Hip Flexion", "stretch"], ["Deep Squat / Eve's Lunge", "Hip Flexion", "stretch"], ["Knee Stretches", "Hip Flexion", "load"], ["Leg Circles (with straps)", "Hip Flexion", "load"],
    ["Side-Lying Leg Abduction (passive)", "Hip Abduction", "stretch"], ["Side-Lying Leg Series (with straps)", "Hip Abduction", "load"], ["Side Plank with Leg Lift", "Hip Abduction", "load"],
    ["Wide-Leg Footwork (passive)", "Hip Adduction", "stretch"], ["Side-Lying Adduction Stretch", "Hip Adduction", "stretch"], ["Adductor Squeezes", "Hip Adduction", "load"], ["Side-Lying Adduction (with strap)", "Hip Adduction", "load"],
    ["Figure-4 Stretch (Reformer / Box)", "Glutes", "stretch"], ["Pigeon Stretch (on Reformer)", "Glutes", "stretch"], ["Footwork (heels)", "Glutes", "load"], ["Single-Leg Glute Bridge", "Glutes", "load"],
    ["Footwork Heel-Cord Stretch", "Hamstrings", "stretch"], ["Leg Circles (passive hamstring stretch)", "Hamstrings", "stretch"], ["Straight-Leg Press", "Hamstrings", "load"], ["Single-Leg Footwork", "Hamstrings", "load"],
    ["Side Plank (passive stretch)", "Back Anti-Side Bending", "stretch"], ["Side Plank (active)", "Back Anti-Side Bending", "load"], ["Single-Arm Side Press", "Back Anti-Side Bending", "load"],
    ["Seated Rotation (passive end-range)", "Back Anti-Rotation", "stretch"], ["Plank with Single Arm / Leg Reach", "Back Anti-Rotation", "load"], ["Oblique Work (resisted rotation)", "Back Anti-Rotation", "load"],
    ["Cat-Cow (on carriage)", "Back Anti-Extension", "stretch"], ["Plank (neutral spine)", "Back Anti-Extension", "load"], ["Dead Bug (strap resistance)", "Back Anti-Extension", "load"],
    ["Supported Extension (on Box)", "Back Anti-Flexion", "stretch"], ["The Hundred (neutral lumbar spine)", "Back Anti-Flexion", "load"], ["Plank (anti-flexion focus)", "Back Anti-Flexion", "load"]
].map(([name, category, type], index) => ({ id: `r${index + 1}`, name, categories: [category], type, instructions: "Session D reformer checklist" }));

SEED_EXERCISES.push(...REFORMER_EXERCISES);

const SEED_TEMPLATES = [
    {
        id: "t1",
        name: "Session A — Posterior Chain & Anti-Extension",
        description: "KB RDL, Roman Chair, Deadbugs, Stretches",
        exercises: [
            { id: "e34", defaultSets: 3, defaultReps: "8-10" },
            { id: "e36", defaultSets: 3, defaultReps: "10-12" },
            { id: "e23", defaultSets: 3, defaultReps: "8/side" },
            { id: "e37", defaultSets: 1, defaultReps: "60s" },
            { id: "e29", defaultSets: 1, defaultReps: "60s" }
        ]
    },
    {
        id: "t2",
        name: "Session B — Lateral Line, Rotation",
        description: "Monster Walks, Copenhagen Plank, Side Bends, Woodchoppers, Stretches",
        exercises: [
            { id: "e39", defaultSets: 3, defaultReps: "12-15" },
            { id: "e43", defaultSets: 3, defaultReps: "15-20s/side" },
            { id: "e9", defaultSets: 3, defaultReps: "10-12/side" },
            { id: "e13", defaultSets: 3, defaultReps: "10/side" },
            { id: "e38", defaultSets: 1, defaultReps: "60s" },
            { id: "e16", defaultSets: 1, defaultReps: "60s" }
        ]
    },
    {
        id: "t3",
        name: "Session C — Anti-Movement, Deep Core",
        description: "Farmer's Carry, Pallof Press, Knee Raises, Banded Crunches, Hip Thrusts",
        exercises: [
            { id: "e17", defaultSets: 3, defaultReps: "30-40 paces" },
            { id: "e20", defaultSets: 3, defaultReps: "10 (3s hold)" },
            { id: "e31", defaultSets: 3, defaultReps: "8-10" },
            { id: "e35", defaultSets: 3, defaultReps: "10-12/side" },
            { id: "e19", defaultSets: 1, defaultReps: "60s" },
            { id: "e4", defaultSets: 1, defaultReps: "60s" }
        ]
    },
    {
        id: "t4",
        name: "Session D — Reformer Integration",
        description: "Check off the Reformer exercises completed during the session.",
        inputMode: "checklist",
        exercises: REFORMER_EXERCISES.map(ex => ({ id: ex.id, checklist: true }))
    },
    {
        id: "t5",
        name: "Session E — Travel Reset & Lumbar Decompression",
        description: "Low-impact reset. Cat-Cow, Deadbug, Side Plank, Bridges, Good Mornings, Stretches",
        exercises: [
            { id: "e47", defaultSets: 1, defaultReps: "8 cycles" },
            { id: "e22", defaultSets: 1, defaultReps: "6 reps/side" },
            { id: "e48", defaultSets: 2, defaultReps: "6 reps/side" },
            { id: "e49", defaultSets: 2, defaultReps: "20-30s/side" },
            { id: "e50", defaultSets: 2, defaultReps: "10-12/side" },
            { id: "e51", defaultSets: 2, defaultReps: "12" },
            { id: "e16", defaultSets: 1, defaultReps: "5 reps/side" },
            { id: "e52", defaultSets: 1, defaultReps: "45s/side" },
            { id: "e38", defaultSets: 1, defaultReps: "45s/side" }
        ]
    },
    {
        id: "t6",
        name: "Routine F - Neck",
        description: "Chin Tucks, Pectoral and Trapezius Stretches, Rows, Wall Slides, Prone Y Raises",
        workoutKind: "neck",
        exercises: [
            { id: "n3", defaultSets: 2, defaultReps: "10" },
            { id: "n1", defaultSets: 2, defaultReps: "30 seconds" },
            { id: "n2", defaultSets: 1, defaultReps: "30s each side" },
            { id: "n4", defaultSets: 3, defaultReps: "10" },
            { id: "n5", defaultSets: 2, defaultReps: "10" },
            { id: "n6", defaultSets: 2, defaultReps: "10" }
        ]
    }
];

export const NECK_EXERCISES = ["n1", "n2", "n3", "n4", "n5", "n6"];

export async function checkAndSeedDB() {
    const exercises = await getAll('exercises');
    if (exercises.length === 0) {
        console.log("Seeding DB...");
        await putAll('exercises', SEED_EXERCISES);
        await putAll('templates', SEED_TEMPLATES);
    } else {
        // Patch in new muscle group exercises if missing
        const existingIds = new Set(exercises.map(e => e.id));
        const missing = SEED_EXERCISES.filter(e => !existingIds.has(e.id));
        if (missing.length > 0) {
            console.log("Adding missing exercises...", missing);
            await putAll('exercises', missing);
        }
        
        // Patch in new templates if missing
        const templates = await getAll('templates');
        const existingTplIds = new Set(templates.map(t => t.id));
        const missingTpls = SEED_TEMPLATES.filter(t => !existingTplIds.has(t.id));
        if (missingTpls.length > 0) {
            console.log("Adding missing templates...", missingTpls);
            await putAll('templates', missingTpls);
        }
        // Migrate existing installs to the current built-in Session D checklist.
        await putAll('exercises', REFORMER_EXERCISES.filter(ex => !exercises.find(old => old.id === ex.id)?.userEdited));
        await putAll('templates', SEED_TEMPLATES.filter(t => t.id === 't4' && !templates.find(old => old.id === t.id)?.userEdited));
        // Migrate existing installs to the current built-in Routine F.
        await putAll('exercises', SEED_EXERCISES.filter(ex => NECK_EXERCISES.includes(ex.id) && !exercises.find(old => old.id === ex.id)?.userEdited));
        await putAll('templates', SEED_TEMPLATES.filter(t => t.id === 't6' && !templates.find(old => old.id === t.id)?.userEdited));
        // Keep Session A's Roman Chair mapping and Session C definition current.
        await putAll('exercises', SEED_EXERCISES.filter(ex => ex.id === 'e36' && !exercises.find(old => old.id === ex.id)?.userEdited));
        await putAll('templates', SEED_TEMPLATES.filter(t => t.id === 't3' && !templates.find(old => old.id === t.id)?.userEdited));
    }
}
