"use client";

import { FormEvent, useMemo, useState, useSyncExternalStore } from "react";

type Profile = {
  id: string;
  name: string;
};

type WorkoutSet = {
  id: string;
  profileId: string;
  bodyPart: string;
  date: string;
  exercise: string;
  weight: number;
  reps: number;
  note: string;
};

type AppState = {
  profiles: Profile[];
  sets: WorkoutSet[];
};

type ExerciseProgress = {
  name: string;
  totalSets: number;
  bestVolume: number;
  bestLabel: string;
  oneRepMax: number;
};

type EditingSetDraft = {
  id: string;
  profileId: string;
  bodyPart: string;
  date: string;
  exercise: string;
  weight: string;
  reps: string;
  note: string;
};

const STORAGE_KEY = "gym-workout-tracker-v2";
const LEGACY_STORAGE_KEY = "gym-workout-tracker-v1";
const STATE_CHANGED_EVENT = "gym-workout-tracker-change";
const DEFAULT_PROFILE_ID = "profile-you";
const FRIEND_PROFILE_ID = "profile-friend";

const exerciseCatalog = {
  Legs: [
    "Smith machine squats",
    "Leg press",
    "Leg extensions",
    "Lying leg curls",
  ],
  Chest: [
    "Bench press",
    "Incline dumbbell press",
    "Machine cable flies upper chest",
    "Machine cable flies lower chest",
  ],
  Triceps: [
    "Cable extensions",
    "Overhead cable extensions",
    "Single arm cable extensions",
  ],
  Back: ["Lat pulldowns", "Lying dumbbell rows", "Lat prayers", "Seated rowing"],
  Biceps: [
    "Seated dumbbell curls",
    "Standing barbell curls",
    "Incline barbell curls",
    "Incline dumbbell curls",
    "Dumbbell hammer curls",
    "Cable bicep curls",
  ],
  Shoulders: [
    "Dumbbell press",
    "Lateral raises with dumbbells",
    "Lateral raises with cables",
    "Reverse pec deck",
    "Face pulls",
  ],
} as const;

const bodyParts = Object.keys(exerciseCatalog);
const editableBodyParts = [...bodyParts, "Rest"];

const starterProfiles: Profile[] = [
  { id: DEFAULT_PROFILE_ID, name: "You" },
  { id: FRIEND_PROFILE_ID, name: "Friend" },
];

const starterSets: WorkoutSet[] = [
  makeSet(DEFAULT_PROFILE_ID, "Legs", "Smith machine squats", 20, 12, "1st set", undefined, "starter-1"),
  makeSet(DEFAULT_PROFILE_ID, "Legs", "Smith machine squats", 25, 7, "2nd set", undefined, "starter-2"),
  makeSet(DEFAULT_PROFILE_ID, "Legs", "Smith machine squats", 25, 8, "3rd set", undefined, "starter-3"),
  makeSet(DEFAULT_PROFILE_ID, "Legs", "Leg press", 20, 12, "1st set", undefined, "starter-4"),
  makeSet(DEFAULT_PROFILE_ID, "Legs", "Leg press", 40, 12, "2nd set", undefined, "starter-5"),
  makeSet(DEFAULT_PROFILE_ID, "Legs", "Leg press", 50, 11, "3rd set", undefined, "starter-6"),
  makeSet(
    DEFAULT_PROFILE_ID,
    "Legs",
    "Lying leg curls",
    0,
    0,
    "2 sets logged without weight/reps",
    undefined,
    "starter-7",
  ),
  makeSet(DEFAULT_PROFILE_ID, "Legs", "Leg extensions", 30, 13, "1st set", undefined, "starter-8"),
  makeSet(DEFAULT_PROFILE_ID, "Legs", "Leg extensions", 50, 12, "2nd set", undefined, "starter-9"),
  makeSet(DEFAULT_PROFILE_ID, "Legs", "Leg extensions", 60, 10, "3rd set", undefined, "starter-10"),
];

const starterState: AppState = {
  profiles: starterProfiles,
  sets: starterSets,
};
const starterStateJson = JSON.stringify(starterState);

function makeSet(
  profileId: string,
  bodyPart: string,
  exercise: string,
  weight: number,
  reps: number,
  note = "",
  date = new Date().toISOString().slice(0, 10),
  id = crypto.randomUUID(),
): WorkoutSet {
  return {
    id,
    profileId,
    bodyPart,
    date,
    exercise,
    weight,
    reps,
    note,
  };
}

function makeProfile(name: string): Profile {
  return {
    id: crypto.randomUUID(),
    name,
  };
}

function subscribeToState(onStoreChange: () => void) {
  window.addEventListener("storage", onStoreChange);
  window.addEventListener(STATE_CHANGED_EVENT, onStoreChange);

  return () => {
    window.removeEventListener("storage", onStoreChange);
    window.removeEventListener(STATE_CHANGED_EVENT, onStoreChange);
  };
}

function getStoredStateSnapshot() {
  const current = window.localStorage.getItem(STORAGE_KEY);

  if (current) {
    return current;
  }

  const legacySets = window.localStorage.getItem(LEGACY_STORAGE_KEY);

  if (!legacySets) {
    return starterStateJson;
  }

  return JSON.stringify({
    profiles: starterProfiles,
    sets: readLegacySets(legacySets),
  });
}

function getServerStateSnapshot() {
  return starterStateJson;
}

function saveStoredState(nextState: AppState) {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(nextState));
  window.dispatchEvent(new Event(STATE_CHANGED_EVENT));
}

function readState(snapshot: string): AppState {
  try {
    const parsed = JSON.parse(snapshot) as Partial<AppState>;
    const profiles = parsed.profiles?.length ? parsed.profiles : starterProfiles;
    const sets = Array.isArray(parsed.sets) ? parsed.sets : [];

    return {
      profiles,
      sets: sets.map((set) => ({
        ...set,
        profileId: set.profileId || profiles[0].id,
        bodyPart: set.bodyPart || getBodyPartForExercise(set.exercise, "Legs"),
      })),
    };
  } catch {
    return starterState;
  }
}

function readLegacySets(snapshot: string): WorkoutSet[] {
  try {
    const legacySets = JSON.parse(snapshot) as Omit<WorkoutSet, "profileId">[];

    return legacySets.map((set) => ({
      ...set,
      profileId: DEFAULT_PROFILE_ID,
      bodyPart: getBodyPartForExercise(set.exercise, "Legs"),
    }));
  } catch {
    return starterSets;
  }
}

function estimateOneRepMax(weight: number, reps: number) {
  if (!weight || !reps) {
    return 0;
  }

  return Math.round(weight * (1 + reps / 30));
}

function parseWorkoutNotes(
  text: string,
  fallbackDate: string,
  profileId: string,
  fallbackBodyPart: string,
) {
  const sets: WorkoutSet[] = [];
  let currentExercise = "";

  text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .forEach((line) => {
      const setMatch = line.match(/(\d+(?:\.\d+)?)\s*\*\s*(\d+)/);
      const exerciseBeforeNumbers = line
        .replace(/\d+(?:\.\d+)?\s*\*\s*\d+.*/i, "")
        .trim();

      if (setMatch) {
        if (exerciseBeforeNumbers) {
          currentExercise = cleanExerciseName(exerciseBeforeNumbers);
        }

        sets.push(
          makeSet(
            profileId,
            getBodyPartForExercise(currentExercise, fallbackBodyPart),
            currentExercise || "Workout set",
            Number(setMatch[1]),
            Number(setMatch[2]),
            line.replace(setMatch[0], "").trim(),
            fallbackDate,
          ),
        );

        return;
      }

      currentExercise = cleanExerciseName(line);
      sets.push(
        makeSet(
          profileId,
          getBodyPartForExercise(currentExercise, fallbackBodyPart),
          currentExercise,
          0,
          0,
          line,
          fallbackDate,
        ),
      );
    });

  return sets;
}

function getBodyPartForExercise(exercise: string, fallback = "Legs") {
  const normalizedExercise = normalizeExercise(exercise);
  const match = bodyParts.find((bodyPart) =>
    exerciseCatalog[bodyPart as keyof typeof exerciseCatalog].some(
      (catalogExercise) =>
        normalizeExercise(catalogExercise) === normalizedExercise,
    ),
  );

  return match || fallback;
}

function normalizeExercise(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function cleanExerciseName(value: string) {
  return value
    .replace(/\b\d+(st|nd|rd|th)?\b/gi, "")
    .replace(/\bset(s)?\b/gi, "")
    .replace(/\s+/g, " ")
    .trim();
}

function getExerciseProgress(sets: WorkoutSet[]): ExerciseProgress[] {
  const trainingSets = sets.filter((set) => !isRestDay(set));
  const exercises = Array.from(
    new Set(trainingSets.map((set) => set.exercise)),
  ).sort();

  return exercises
    .map((name) => {
      const exerciseSets = trainingSets.filter((set) => set.exercise === name);
      const bestSet = exerciseSets.reduce((best, current) => {
        return current.weight * current.reps > best.weight * best.reps
          ? current
          : best;
      }, exerciseSets[0]);

      return {
        name,
        totalSets: exerciseSets.length,
        bestVolume: bestSet.weight * bestSet.reps,
        bestLabel:
          bestSet.weight && bestSet.reps
            ? `${bestSet.weight} x ${bestSet.reps}`
            : "Needs details",
        oneRepMax: estimateOneRepMax(bestSet.weight, bestSet.reps),
      };
    })
    .sort((a, b) => b.bestVolume - a.bestVolume);
}

function profileVolume(sets: WorkoutSet[]) {
  return sets.reduce((total, set) => total + set.weight * set.reps, 0);
}

function isRestDay(set: WorkoutSet) {
  return set.bodyPart === "Rest" || set.exercise === "Rest day";
}

function getSetOrder(set: WorkoutSet, index: number) {
  const match = set.note.match(/\b(\d+)\s*(st|nd|rd|th)?\b/i);

  return match ? Number(match[1]) : index + 1;
}

function buildSetNote(setNumber: string, note: string) {
  const cleanNote = note.trim();
  const setLabel = `Set ${setNumber}`;

  return cleanNote ? `${setLabel} - ${cleanNote}` : setLabel;
}

export default function Home() {
  const stateSnapshot = useSyncExternalStore(
    subscribeToState,
    getStoredStateSnapshot,
    getServerStateSnapshot,
  );
  const state = useMemo(() => readState(stateSnapshot), [stateSnapshot]);
  const [activeProfileId, setActiveProfileId] = useState(DEFAULT_PROFILE_ID);
  const [compareProfileId, setCompareProfileId] = useState(FRIEND_PROFILE_ID);
  const [newProfileName, setNewProfileName] = useState("");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [bodyPart, setBodyPart] = useState("Legs");
  const [exercise, setExercise] = useState("Smith machine squats");
  const [setNumber, setSetNumber] = useState("1");
  const [weight, setWeight] = useState("25");
  const [reps, setReps] = useState("8");
  const [note, setNote] = useState("");
  const [restNote, setRestNote] = useState("");
  const [quickNotes, setQuickNotes] = useState("");
  const [selectedExercise, setSelectedExercise] = useState("All");
  const [editingSet, setEditingSet] = useState<EditingSetDraft | null>(null);

  const activeProfile =
    state.profiles.find((profile) => profile.id === activeProfileId) ||
    state.profiles[0];
  const compareProfile =
    state.profiles.find((profile) => profile.id === compareProfileId) ||
    state.profiles.find((profile) => profile.id !== activeProfile.id) ||
    activeProfile;
  const activeSets = useMemo(
    () => state.sets.filter((set) => set.profileId === activeProfile.id),
    [activeProfile.id, state.sets],
  );
  const activeTrainingSets = useMemo(
    () => activeSets.filter((set) => !isRestDay(set)),
    [activeSets],
  );
  const compareSets = useMemo(
    () => state.sets.filter((set) => set.profileId === compareProfile.id),
    [compareProfile.id, state.sets],
  );
  const compareTrainingSets = useMemo(
    () => compareSets.filter((set) => !isRestDay(set)),
    [compareSets],
  );
  const profileNameById = useMemo(() => {
    return new Map(state.profiles.map((profile) => [profile.id, profile.name]));
  }, [state.profiles]);
  const catalogExercises =
    exerciseCatalog[bodyPart as keyof typeof exerciseCatalog];

  const exercises = useMemo(
    () =>
      Array.from(
        new Set(activeTrainingSets.map((set) => set.exercise)),
      ).sort(),
    [activeTrainingSets],
  );

  const filteredSets = useMemo(() => {
    const visible =
      selectedExercise === "All"
        ? activeSets
        : activeSets.filter((set) => set.exercise === selectedExercise);

    return [...visible].sort((a, b) => b.date.localeCompare(a.date));
  }, [activeSets, selectedExercise]);

  const progress = useMemo(
    () => getExerciseProgress(activeTrainingSets),
    [activeTrainingSets],
  );
  const setBreakdowns = useMemo(() => {
    return progress.map((item) => {
      const exerciseSets = activeTrainingSets
        .filter((set) => set.exercise === item.name)
        .sort((a, b) => {
          const dateSort = b.date.localeCompare(a.date);

          return dateSort || getSetOrder(a, 0) - getSetOrder(b, 0);
        });

      return {
        name: item.name,
        bodyPart: exerciseSets[0]?.bodyPart || getBodyPartForExercise(item.name),
        sets: exerciseSets,
      };
    });
  }, [activeTrainingSets, progress]);
  const previousExerciseSets = useMemo(() => {
    const matchingSets = activeTrainingSets
      .filter((set) => set.exercise === exercise)
      .sort((a, b) => b.date.localeCompare(a.date));
    const lastDate = matchingSets[0]?.date;

    if (!lastDate) {
      return [];
    }

    return matchingSets
      .filter((set) => set.date === lastDate)
      .sort((a, b) => getSetOrder(a, 0) - getSetOrder(b, 0));
  }, [activeTrainingSets, exercise]);

  const comparisonRows = useMemo(() => {
    const leftProgress = getExerciseProgress(activeTrainingSets);
    const rightProgress = getExerciseProgress(compareTrainingSets);
    const exerciseNames = Array.from(
      new Set([...leftProgress, ...rightProgress].map((item) => item.name)),
    ).sort();

    return exerciseNames.map((name) => {
      const left = leftProgress.find((item) => item.name === name);
      const right = rightProgress.find((item) => item.name === name);
      const leftMax = left?.oneRepMax || 0;
      const rightMax = right?.oneRepMax || 0;

      return {
        name,
        leftBest: left?.bestLabel || "-",
        rightBest: right?.bestLabel || "-",
        leftMax,
        rightMax,
        leader:
          leftMax === rightMax
            ? "Tie"
            : leftMax > rightMax
              ? activeProfile.name
              : compareProfile.name,
      };
    });
  }, [
    activeProfile.name,
    activeTrainingSets,
    compareProfile.name,
    compareTrainingSets,
  ]);

  function addProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const name = newProfileName.trim();

    if (!name) {
      return;
    }

    const profile = makeProfile(name);
    saveStoredState({
      ...state,
      profiles: [...state.profiles, profile],
    });
    setActiveProfileId(profile.id);
    setNewProfileName("");
  }

  function selectBodyPart(nextBodyPart: string) {
    const nextExercises =
      exerciseCatalog[nextBodyPart as keyof typeof exerciseCatalog];

    setBodyPart(nextBodyPart);
    setExercise(nextExercises[0]);
    setSelectedExercise("All");
  }

  function removeProfile(profileId: string) {
    if (state.profiles.length <= 1) {
      return;
    }

    const nextProfiles = state.profiles.filter(
      (profile) => profile.id !== profileId,
    );
    const nextActiveProfile =
      activeProfile.id === profileId
        ? nextProfiles[0]
        : activeProfile;
    const nextCompareProfile =
      compareProfile.id === profileId || compareProfile.id === nextActiveProfile.id
        ? nextProfiles.find((profile) => profile.id !== nextActiveProfile.id) ||
          nextActiveProfile
        : compareProfile;

    saveStoredState({
      profiles: nextProfiles,
      sets: state.sets.filter((set) => set.profileId !== profileId),
    });

    setActiveProfileId(nextActiveProfile.id);
    setCompareProfileId(nextCompareProfile.id);
    setSelectedExercise("All");
  }

  function addSet(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!exercise.trim()) {
      return;
    }

    saveStoredState({
      ...state,
      sets: [
        makeSet(
          activeProfile.id,
          bodyPart,
          exercise.trim(),
          Number(weight),
          Number(reps),
          buildSetNote(setNumber, note),
          date,
        ),
        ...state.sets,
      ],
    });
    setNote("");
  }

  function addRestDay() {
    saveStoredState({
      ...state,
      sets: [
        makeSet(
          activeProfile.id,
          "Rest",
          "Rest day",
          0,
          0,
          restNote.trim() || "Recovery",
          date,
        ),
        ...state.sets,
      ],
    });
    setRestNote("");
  }

  function importQuickNotes() {
    const importedSets = parseWorkoutNotes(
      quickNotes,
      date,
      activeProfile.id,
      bodyPart,
    );

    if (!importedSets.length) {
      return;
    }

    saveStoredState({
      ...state,
      sets: [...importedSets, ...state.sets],
    });
    setQuickNotes("");
  }

  function deleteSet(id: string) {
    saveStoredState({
      ...state,
      sets: state.sets.filter((set) => set.id !== id),
    });
  }

  function startEditingSet(set: WorkoutSet) {
    setEditingSet({
      id: set.id,
      profileId: set.profileId,
      bodyPart: set.bodyPart,
      date: set.date,
      exercise: set.exercise,
      weight: String(set.weight),
      reps: String(set.reps),
      note: set.note,
    });
  }

  function updateEditingSet(field: keyof EditingSetDraft, value: string) {
    setEditingSet((current) => {
      if (!current) {
        return current;
      }

      if (field === "bodyPart") {
        if (value === "Rest") {
          return {
            ...current,
            bodyPart: "Rest",
            exercise: "Rest day",
            weight: "0",
            reps: "0",
          };
        }

        const nextExercises =
          exerciseCatalog[value as keyof typeof exerciseCatalog];

        return {
          ...current,
          bodyPart: value,
          exercise: (nextExercises as readonly string[]).includes(
            current.exercise,
          )
            ? current.exercise
            : nextExercises[0],
        };
      }

      return { ...current, [field]: value };
    });
  }

  function saveEditingSet() {
    if (!editingSet?.exercise.trim()) {
      return;
    }

    saveStoredState({
      ...state,
      sets: state.sets.map((set) =>
        set.id === editingSet.id
          ? {
              ...set,
              profileId: editingSet.profileId,
              bodyPart: editingSet.bodyPart,
              date: editingSet.date,
              exercise: editingSet.exercise.trim(),
              weight: Number(editingSet.weight),
              reps: Number(editingSet.reps),
              note: editingSet.note.trim(),
            }
          : set,
      ),
    });
    setEditingSet(null);
  }

  return (
    <main className="min-h-screen bg-black text-zinc-100">
      <section className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-5 sm:px-6 lg:px-8">
        <header className="flex flex-col gap-5 border-b border-zinc-900 pb-5 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-zinc-500">
              Training log
            </p>
            <h1 className="mt-2 text-3xl font-semibold tracking-normal text-white sm:text-4xl">
              Workout tracker
            </h1>
          </div>
          <div className="grid gap-2 sm:grid-cols-3">
            <Metric label="Active" value={activeProfile.name} />
            <Metric label="Sets" value={activeTrainingSets.length.toString()} />
            <Metric
              label="Volume"
              value={profileVolume(activeSets).toLocaleString()}
            />
          </div>
        </header>

        <section className="grid gap-3 rounded-md border border-zinc-900 bg-zinc-950 p-4 lg:grid-cols-[1fr_320px]">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-zinc-600">
              Profiles
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              {state.profiles.map((profile) => (
                <div
                  key={profile.id}
                  className={`flex h-10 items-center overflow-hidden rounded-md border transition ${
                    profile.id === activeProfile.id
                      ? "border-white bg-white text-black"
                      : "border-zinc-800 text-zinc-300 hover:border-zinc-500"
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => setActiveProfileId(profile.id)}
                    className="h-full px-4 text-sm font-semibold"
                  >
                    {profile.name}
                  </button>
                  <button
                    type="button"
                    onClick={() => removeProfile(profile.id)}
                    disabled={state.profiles.length <= 1}
                    className={`h-full border-l px-3 text-xs font-semibold transition ${
                      profile.id === activeProfile.id
                        ? "border-zinc-300 text-zinc-600 hover:bg-zinc-200"
                        : "border-zinc-800 text-zinc-500 hover:text-red-400 disabled:text-zinc-800"
                    }`}
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>
          </div>
          <form onSubmit={addProfile} className="flex gap-2">
            <input
              value={newProfileName}
              onChange={(event) => setNewProfileName(event.target.value)}
              className="h-10 min-w-0 flex-1 rounded-md border border-zinc-800 bg-black px-3 text-sm text-zinc-100 outline-none transition placeholder:text-zinc-700 focus:border-zinc-500"
              placeholder="Add friend"
            />
            <button className="h-10 rounded-md border border-zinc-700 px-4 text-sm font-semibold text-zinc-100 transition hover:border-zinc-400">
              Add
            </button>
          </form>
        </section>

        <div className="grid gap-5 lg:grid-cols-[390px_1fr]">
          <section className="space-y-4">
            <form
              onSubmit={addSet}
              className="rounded-md border border-zinc-900 bg-zinc-950 p-4"
            >
              <h2 className="text-base font-semibold text-white">
                Add set for {activeProfile.name}
              </h2>
              <div className="mt-4 grid gap-3">
                <FieldLabel label="Date">
                  <input
                    type="date"
                    value={date}
                    onChange={(event) => setDate(event.target.value)}
                    className={inputClassName}
                  />
                </FieldLabel>
                <FieldLabel label="Body part">
                  <select
                    value={bodyPart}
                    onChange={(event) => selectBodyPart(event.target.value)}
                    className={selectClassName}
                  >
                    {bodyParts.map((part) => (
                      <option key={part}>{part}</option>
                    ))}
                  </select>
                </FieldLabel>
                <FieldLabel label="Exercise">
                  <select
                    value={exercise}
                    onChange={(event) => setExercise(event.target.value)}
                    className={selectClassName}
                  >
                    {catalogExercises.map((catalogExercise) => (
                      <option key={catalogExercise}>{catalogExercise}</option>
                    ))}
                  </select>
                </FieldLabel>
                <div>
                  <p className="text-xs font-medium uppercase tracking-[0.14em] text-zinc-500">
                    Set number
                  </p>
                  <div className="mt-1.5 grid grid-cols-5 gap-2">
                    {["1", "2", "3", "4", "5"].map((number) => (
                      <button
                        key={number}
                        type="button"
                        onClick={() => setSetNumber(number)}
                        className={`h-10 rounded-md border text-sm font-semibold transition ${
                          setNumber === number
                            ? "border-white bg-white text-black"
                            : "border-zinc-800 bg-black text-zinc-400 hover:border-zinc-500 hover:text-white"
                        }`}
                      >
                        Set {number}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <FieldLabel label="Weight">
                    <input
                      type="number"
                      min="0"
                      step="0.5"
                      value={weight}
                      onChange={(event) => setWeight(event.target.value)}
                      className={inputClassName}
                    />
                  </FieldLabel>
                  <FieldLabel label="Reps">
                    <input
                      type="number"
                      min="0"
                      value={reps}
                      onChange={(event) => setReps(event.target.value)}
                      className={inputClassName}
                    />
                  </FieldLabel>
                </div>
                <FieldLabel label="Note">
                  <input
                    value={note}
                    onChange={(event) => setNote(event.target.value)}
                    className={inputClassName}
                    placeholder="2nd set, felt easy"
                  />
                </FieldLabel>
              </div>
              <div className="mt-4 rounded-md border border-zinc-900 bg-black p-3">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-zinc-500">
                    Last time
                  </p>
                  <span className="text-xs text-zinc-600">
                    {previousExerciseSets[0]?.date || "No history"}
                  </span>
                </div>
                <div className="mt-3 grid gap-2">
                  {previousExerciseSets.length ? (
                    previousExerciseSets.map((set, index) => (
                      <div
                        key={set.id}
                        className="grid grid-cols-[56px_1fr_72px] gap-2 rounded-md border border-zinc-900 px-3 py-2 text-sm"
                      >
                        <span className="text-zinc-500">Set {index + 1}</span>
                        <span className="font-semibold text-zinc-100">
                          {set.weight || "-"} x {set.reps || "-"}
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            setWeight(String(set.weight));
                            setReps(String(set.reps));
                            setSetNumber(String(getSetOrder(set, index)));
                          }}
                          className="text-right text-xs font-semibold text-zinc-400 transition hover:text-white"
                        >
                          Use
                        </button>
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-zinc-500">
                      No previous sets for this exercise.
                    </p>
                  )}
                </div>
              </div>
              <button className="mt-4 h-11 w-full rounded-md bg-white px-4 text-sm font-semibold text-black transition hover:bg-zinc-200">
                Add set
              </button>
            </form>

            <section className="rounded-md border border-zinc-900 bg-zinc-950 p-4">
              <h2 className="text-base font-semibold text-white">
                Rest day
              </h2>
              <div className="mt-4 grid gap-3">
                <FieldLabel label="Date">
                  <input
                    type="date"
                    value={date}
                    onChange={(event) => setDate(event.target.value)}
                    className={inputClassName}
                  />
                </FieldLabel>
                <FieldLabel label="Note">
                  <input
                    value={restNote}
                    onChange={(event) => setRestNote(event.target.value)}
                    className={inputClassName}
                    placeholder="Sleep, soreness, travel"
                  />
                </FieldLabel>
              </div>
              <button
                type="button"
                onClick={addRestDay}
                className="mt-4 h-11 w-full rounded-md border border-zinc-700 px-4 text-sm font-semibold text-zinc-100 transition hover:border-zinc-400 hover:bg-zinc-900"
              >
                Mark rest day
              </button>
            </section>

            <section className="rounded-md border border-zinc-900 bg-zinc-950 p-4">
              <h2 className="text-base font-semibold text-white">
                Paste notes for {activeProfile.name}
              </h2>
              <textarea
                value={quickNotes}
                onChange={(event) => setQuickNotes(event.target.value)}
                className="mt-4 min-h-44 w-full resize-y rounded-md border border-zinc-800 bg-black p-3 text-sm leading-6 text-zinc-100 outline-none transition placeholder:text-zinc-700 focus:border-zinc-500"
                placeholder={`20 *12 1st set smith machine squats
25* 7 2nd
25 *8 3 rd
20 *12 1 set leg press`}
              />
              <button
                type="button"
                onClick={importQuickNotes}
                className="mt-3 h-11 w-full rounded-md border border-zinc-700 px-4 text-sm font-semibold text-zinc-100 transition hover:border-zinc-400 hover:bg-zinc-900"
              >
                Import notes
              </button>
            </section>

            <section className="rounded-md border border-zinc-900 bg-zinc-950 p-4">
              <h2 className="text-base font-semibold text-white">
                Exercise list
              </h2>
              <div className="mt-4 grid gap-3">
                {bodyParts.map((part) => (
                  <div
                    key={part}
                    className="rounded-md border border-zinc-900 bg-black p-3"
                  >
                    <p className="text-xs font-semibold uppercase tracking-[0.14em] text-zinc-500">
                      {part}
                    </p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {exerciseCatalog[
                        part as keyof typeof exerciseCatalog
                      ].map((catalogExercise) => (
                        <button
                          key={catalogExercise}
                          type="button"
                          onClick={() => {
                            setBodyPart(part);
                            setExercise(catalogExercise);
                          }}
                          className="rounded-md border border-zinc-800 px-2.5 py-1.5 text-left text-xs font-medium text-zinc-300 transition hover:border-zinc-500 hover:text-white"
                        >
                          {catalogExercise}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          </section>

          <section className="space-y-4">
            <div className="rounded-md border border-zinc-900 bg-zinc-950 p-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <h2 className="text-base font-semibold text-white">
                  Compare
                </h2>
                <select
                  value={compareProfile.id}
                  onChange={(event) => setCompareProfileId(event.target.value)}
                  className={selectClassName}
                >
                  {state.profiles
                    .filter((profile) => profile.id !== activeProfile.id)
                    .map((profile) => (
                      <option key={profile.id} value={profile.id}>
                        {profile.name}
                      </option>
                    ))}
                  {state.profiles.length === 1 && (
                    <option value={activeProfile.id}>{activeProfile.name}</option>
                  )}
                </select>
              </div>

              <div className="mt-4 grid gap-3 sm:grid-cols-3">
                <CompareMetric
                  label="Volume"
                  left={profileVolume(activeSets).toLocaleString()}
                  right={profileVolume(compareSets).toLocaleString()}
                />
                <CompareMetric
                  label="Sets"
                  left={activeTrainingSets.length.toString()}
                  right={compareTrainingSets.length.toString()}
                />
                <CompareMetric
                  label="Exercises"
                  left={new Set(activeTrainingSets.map((set) => set.exercise)).size.toString()}
                  right={new Set(compareTrainingSets.map((set) => set.exercise)).size.toString()}
                />
              </div>

              <div className="mt-4 overflow-hidden rounded-md border border-zinc-900">
                <div className="grid grid-cols-[1fr_84px_84px_72px] gap-3 border-b border-zinc-900 bg-black px-4 py-3 text-xs font-semibold uppercase tracking-[0.14em] text-zinc-600 sm:grid-cols-[1fr_110px_110px_120px]">
                  <span>Exercise</span>
                  <span>{activeProfile.name}</span>
                  <span>{compareProfile.name}</span>
                  <span>Lead</span>
                </div>
                {comparisonRows.map((row) => (
                  <div
                    key={row.name}
                    className="grid grid-cols-[1fr_84px_84px_72px] gap-3 border-b border-zinc-900 px-4 py-3 text-sm last:border-b-0 sm:grid-cols-[1fr_110px_110px_120px]"
                  >
                    <span className="font-medium text-white">{row.name}</span>
                    <span className="text-zinc-300">{row.leftBest}</span>
                    <span className="text-zinc-300">{row.rightBest}</span>
                    <span className="text-zinc-500">{row.leader}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex flex-col gap-3 rounded-md border border-zinc-900 bg-zinc-950 p-4 sm:flex-row sm:items-center sm:justify-between">
              <h2 className="text-base font-semibold text-white">
                {activeProfile.name} log
              </h2>
              <select
                value={selectedExercise}
                onChange={(event) => setSelectedExercise(event.target.value)}
                className={selectClassName}
              >
                <option>All</option>
                {exercises.map((name) => (
                  <option key={name}>{name}</option>
                ))}
              </select>
            </div>

            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {progress.map((item) => (
                <article
                  key={item.name}
                  className="rounded-md border border-zinc-900 bg-zinc-950 p-4"
                >
                  <h3 className="text-sm font-semibold text-white">
                    {item.name}
                  </h3>
                  <dl className="mt-4 grid grid-cols-3 gap-2 text-sm">
                    <Stat label="Best" value={item.bestLabel} />
                    <Stat label="Est. max" value={String(item.oneRepMax)} />
                    <Stat label="Sets" value={String(item.totalSets)} />
                  </dl>
                </article>
              ))}
            </div>

            <div className="rounded-md border border-zinc-900 bg-zinc-950 p-4">
              <h2 className="text-base font-semibold text-white">
                Set breakdown
              </h2>
              <div className="mt-4 grid gap-3 md:grid-cols-2">
                {setBreakdowns.map((item) => (
                  <article
                    key={item.name}
                    className="rounded-md border border-zinc-900 bg-black p-3"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <h3 className="text-sm font-semibold text-white">
                        {item.name}
                      </h3>
                      <span className="rounded-md border border-zinc-800 px-2 py-1 text-xs font-semibold text-zinc-400">
                        {item.bodyPart}
                      </span>
                    </div>
                    <div className="mt-3 grid gap-2">
                      {item.sets.map((set, index) => (
                        <div
                          key={set.id}
                          className="grid grid-cols-[56px_1fr_72px] gap-2 rounded-md border border-zinc-900 px-3 py-2 text-sm"
                        >
                          <span className="text-zinc-500">
                            Set {getSetOrder(set, index)}
                          </span>
                          <span className="font-semibold text-zinc-100">
                            {set.weight || "-"} x {set.reps || "-"}
                          </span>
                          <span className="text-right text-zinc-500">
                            {set.date.slice(5)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </article>
                ))}
              </div>
            </div>

            <div className="overflow-x-auto rounded-md border border-zinc-900 bg-zinc-950">
              <div className="min-w-[900px]">
                <div className="grid grid-cols-[92px_106px_96px_1fr_74px_58px_1fr_118px] gap-3 border-b border-zinc-900 bg-black px-4 py-3 text-xs font-semibold uppercase tracking-[0.14em] text-zinc-600">
                <span className="hidden sm:block">Date</span>
                <span>Person</span>
                <span>Part</span>
                <span>Exercise</span>
                <span>Weight</span>
                <span>Reps</span>
                <span className="hidden sm:block">Note</span>
                <span></span>
              </div>
              {filteredSets.map((set) => (
                <div
                  key={set.id}
                  className="grid grid-cols-[92px_106px_96px_1fr_74px_58px_1fr_118px] gap-3 border-b border-zinc-900 px-4 py-3 text-sm text-zinc-200 last:border-b-0"
                >
                  {editingSet?.id === set.id ? (
                    <>
                      <input
                        type="date"
                        value={editingSet.date}
                        onChange={(event) =>
                          updateEditingSet("date", event.target.value)
                        }
                        className={compactInputClassName}
                      />
                      <select
                        value={editingSet.profileId}
                        onChange={(event) =>
                          updateEditingSet("profileId", event.target.value)
                        }
                        className={compactSelectClassName}
                      >
                        {state.profiles.map((profile) => (
                          <option key={profile.id} value={profile.id}>
                            {profile.name}
                          </option>
                        ))}
                      </select>
                      <select
                        value={editingSet.bodyPart}
                        onChange={(event) =>
                          updateEditingSet("bodyPart", event.target.value)
                        }
                        className={compactSelectClassName}
                      >
                        {editableBodyParts.map((part) => (
                          <option key={part}>{part}</option>
                        ))}
                      </select>
                      {editingSet.bodyPart === "Rest" ? (
                        <input
                          value="Rest day"
                          readOnly
                          className={compactInputClassName}
                        />
                      ) : (
                        <select
                          value={editingSet.exercise}
                          onChange={(event) =>
                            updateEditingSet("exercise", event.target.value)
                          }
                          className={compactSelectClassName}
                        >
                          {exerciseCatalog[
                            editingSet.bodyPart as keyof typeof exerciseCatalog
                          ].map((catalogExercise) => (
                            <option key={catalogExercise}>
                              {catalogExercise}
                            </option>
                          ))}
                        </select>
                      )}
                      <input
                        type="number"
                        min="0"
                        step="0.5"
                        value={editingSet.weight}
                        onChange={(event) =>
                          updateEditingSet("weight", event.target.value)
                        }
                        className={compactInputClassName}
                      />
                      <input
                        type="number"
                        min="0"
                        value={editingSet.reps}
                        onChange={(event) =>
                          updateEditingSet("reps", event.target.value)
                        }
                        className={compactInputClassName}
                      />
                      <input
                        value={editingSet.note}
                        onChange={(event) =>
                          updateEditingSet("note", event.target.value)
                        }
                        className={compactInputClassName}
                        placeholder="Note"
                      />
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={saveEditingSet}
                          className="h-8 flex-1 rounded-md bg-white px-2 text-xs font-semibold text-black transition hover:bg-zinc-200"
                        >
                          Save
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditingSet(null)}
                          className="h-8 flex-1 rounded-md border border-zinc-800 px-2 text-xs font-semibold text-zinc-400 transition hover:border-zinc-500"
                        >
                          Cancel
                        </button>
                      </div>
                    </>
                  ) : (
                    <>
                      <span className="text-zinc-500">{set.date}</span>
                      <span className="truncate rounded-md border border-zinc-800 px-2 py-1 text-xs font-semibold text-zinc-300">
                        {profileNameById.get(set.profileId) || "Unknown"}
                      </span>
                      <span className="truncate text-zinc-500">
                        {set.bodyPart}
                      </span>
                      <span className="font-medium text-white">
                        {set.exercise}
                      </span>
                      <span>{set.weight || "-"}</span>
                      <span>{set.reps || "-"}</span>
                      <span className="text-zinc-500">
                        {set.note || "-"}
                      </span>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => startEditingSet(set)}
                          className="h-8 flex-1 rounded-md border border-zinc-800 px-2 text-xs font-semibold text-zinc-300 transition hover:border-zinc-500"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => deleteSet(set.id)}
                          className="h-8 flex-1 rounded-md border border-zinc-800 px-2 text-xs font-semibold text-zinc-400 transition hover:border-red-500 hover:text-red-400"
                        >
                          Del
                        </button>
                      </div>
                    </>
                  )}
                </div>
              ))}
              </div>
            </div>
          </section>
        </div>
      </section>
    </main>
  );
}

const inputClassName =
  "h-11 rounded-md border border-zinc-800 bg-black px-3 text-sm text-zinc-100 outline-none transition placeholder:text-zinc-700 focus:border-zinc-500";

const selectClassName =
  "h-11 rounded-md border border-zinc-800 bg-black px-3 text-sm text-zinc-100 outline-none transition focus:border-zinc-500";

const compactInputClassName =
  "h-8 min-w-0 rounded-md border border-zinc-800 bg-black px-2 text-xs text-zinc-100 outline-none transition placeholder:text-zinc-700 focus:border-zinc-500";

const compactSelectClassName =
  "h-8 min-w-0 rounded-md border border-zinc-800 bg-black px-2 text-xs text-zinc-100 outline-none transition focus:border-zinc-500";

function FieldLabel({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="grid gap-1.5 text-xs font-medium uppercase tracking-[0.14em] text-zinc-500">
      {label}
      {children}
    </label>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-24 rounded-md border border-zinc-900 bg-zinc-950 px-3 py-2">
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-zinc-600">
        {label}
      </p>
      <p className="mt-1 truncate text-2xl font-semibold text-white">{value}</p>
    </div>
  );
}

function CompareMetric({
  label,
  left,
  right,
}: {
  label: string;
  left: string;
  right: string;
}) {
  return (
    <div className="rounded-md border border-zinc-900 bg-black px-3 py-2">
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-zinc-600">
        {label}
      </p>
      <p className="mt-1 text-sm text-zinc-400">
        <span className="font-semibold text-white">{left}</span>
        <span className="mx-2 text-zinc-700">/</span>
        <span>{right}</span>
      </p>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs font-semibold uppercase tracking-[0.14em] text-zinc-600">
        {label}
      </dt>
      <dd className="mt-1 font-semibold text-zinc-100">{value}</dd>
    </div>
  );
}
