"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "@/utils/supabase/client";

type Profile = {
  id: string;
  name: string;
};

type WorkoutEntry = {
  kind: "workout";
  id: string;
  profileId: string;
  bodyPart: string;
  date: string;
  exercise: string;
  weight: number;
  reps: number;
  note: string;
  createdAt: string;
};

type RestEntry = {
  kind: "rest";
  id: string;
  profileId: string;
  bodyPart: "Rest";
  date: string;
  exercise: "Rest day";
  weight: 0;
  reps: 0;
  note: string;
  createdAt: string;
};

type Entry = WorkoutEntry | RestEntry;

type EditingEntryDraft = {
  id: string;
  kind: Entry["kind"];
  profileId: string;
  bodyPart: string;
  date: string;
  exercise: string;
  weight: string;
  reps: string;
  note: string;
};

type ExerciseProgress = {
  name: string;
  totalSets: number;
  bestVolume: number;
  bestLabel: string;
  oneRepMax: number;
};

type LegacyState = {
  profiles: Profile[];
  sets: Array<{
    id: string;
    profileId: string;
    bodyPart: string;
    date: string;
    exercise: string;
    weight: number;
    reps: number;
    note: string;
  }>;
};

type ProfileRow = {
  id: string;
  name: string;
  created_at: string;
};

type WorkoutRow = {
  id: string;
  profile_id: string;
  body_part: string;
  exercise: string;
  weight: number;
  reps: number;
  note: string;
  workout_date: string;
  created_at: string;
};

type RestRow = {
  id: string;
  profile_id: string;
  rest_date: string;
  note: string;
  created_at: string;
};

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

const STORAGE_KEY = "gym-workout-tracker-v2";
const LEGACY_STORAGE_KEY = "gym-workout-tracker-v1";
const DEFAULT_PROFILE_ID = "9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d";
const FRIEND_PROFILE_ID = "e4b8b6a3-2c1b-4cf7-9a4f-5c24d1a58cde";

const starterProfiles: Profile[] = [
  { id: DEFAULT_PROFILE_ID, name: "You" },
  { id: FRIEND_PROFILE_ID, name: "Friend" },
];

const starterWorkoutEntries: WorkoutEntry[] = [
  makeWorkoutEntry(DEFAULT_PROFILE_ID, "Legs", "Smith machine squats", 20, 12, "1st set", undefined, "c8f1c8a1-1234-4bc1-a123-56789abcdef1"),
  makeWorkoutEntry(DEFAULT_PROFILE_ID, "Legs", "Smith machine squats", 25, 7, "2nd set", undefined, "c8f1c8a2-1234-4bc2-a123-56789abcdef2"),
  makeWorkoutEntry(DEFAULT_PROFILE_ID, "Legs", "Smith machine squats", 25, 8, "3rd set", undefined, "c8f1c8a3-1234-4bc3-a123-56789abcdef3"),
  makeWorkoutEntry(DEFAULT_PROFILE_ID, "Legs", "Leg press", 20, 12, "1st set", undefined, "c8f1c8a4-1234-4bc4-a123-56789abcdef4"),
  makeWorkoutEntry(DEFAULT_PROFILE_ID, "Legs", "Leg press", 40, 12, "2nd set", undefined, "c8f1c8a5-1234-4bc5-a123-56789abcdef5"),
  makeWorkoutEntry(DEFAULT_PROFILE_ID, "Legs", "Leg press", 50, 11, "3rd set", undefined, "c8f1c8a6-1234-4bc6-a123-56789abcdef6"),
  makeWorkoutEntry(
    DEFAULT_PROFILE_ID,
    "Legs",
    "Lying leg curls",
    0,
    0,
    "2 sets logged without weight/reps",
    undefined,
    "c8f1c8a7-1234-4bc7-a123-56789abcdef7",
  ),
  makeWorkoutEntry(DEFAULT_PROFILE_ID, "Legs", "Leg extensions", 30, 13, "1st set", undefined, "c8f1c8a8-1234-4bc8-a123-56789abcdef8"),
  makeWorkoutEntry(DEFAULT_PROFILE_ID, "Legs", "Leg extensions", 50, 12, "2nd set", undefined, "c8f1c8a9-1234-4bc9-a123-56789abcdef9"),
  makeWorkoutEntry(DEFAULT_PROFILE_ID, "Legs", "Leg extensions", 60, 10, "3rd set", undefined, "c8f1c8aa-1234-4bca-a123-56789abcdefa"),
];

function makeWorkoutEntry(
  profileId: string,
  bodyPart: string,
  exercise: string,
  weight: number,
  reps: number,
  note = "",
  date = new Date().toISOString().slice(0, 10),
  id = crypto.randomUUID(),
  createdAt = new Date().toISOString(),
): WorkoutEntry {
  return {
    kind: "workout",
    id,
    profileId,
    bodyPart,
    date,
    exercise,
    weight,
    reps,
    note,
    createdAt,
  };
}

function makeRestEntry(
  profileId: string,
  note = "Recovery",
  date = new Date().toISOString().slice(0, 10),
  id = crypto.randomUUID(),
  createdAt = new Date().toISOString(),
): RestEntry {
  return {
    kind: "rest",
    id,
    profileId,
    bodyPart: "Rest",
    date,
    exercise: "Rest day",
    weight: 0,
    reps: 0,
    note,
    createdAt,
  };
}

function buildSetNote(setNumber: string, note: string) {
  const cleanNote = note.trim();
  const setLabel = `Set ${setNumber}`;

  return cleanNote ? `${setLabel} - ${cleanNote}` : setLabel;
}

function isRestEntry(entry: Entry) {
  return entry.kind === "rest";
}

function estimateOneRepMax(weight: number, reps: number) {
  if (!weight || !reps) {
    return 0;
  }

  return Math.round(weight * (1 + reps / 30));
}

function normalizeExercise(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
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

function cleanExerciseName(value: string) {
  return value
    .replace(/\b\d+(st|nd|rd|th)?\b/gi, "")
    .replace(/\bset(s)?\b/gi, "")
    .replace(/\s+/g, " ")
    .trim();
}

function parseWorkoutNotes(
  text: string,
  fallbackDate: string,
  profileId: string,
  fallbackBodyPart: string,
) {
  const entries: WorkoutEntry[] = [];
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

        entries.push(
          makeWorkoutEntry(
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
      entries.push(
        makeWorkoutEntry(
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

  return entries;
}

function parseLegacySnapshot(raw: string): LegacyState | null {
  try {
    const parsed = JSON.parse(raw) as Partial<LegacyState>;
    if (!parsed.profiles || !parsed.sets) {
      return null;
    }

    return {
      profiles: parsed.profiles,
      sets: parsed.sets,
    };
  } catch {
    return null;
  }
}

function legacyToEntries(legacy: LegacyState) {
  const workoutEntries: WorkoutEntry[] = [];
  const restEntries: RestEntry[] = [];

  legacy.sets.forEach((set) => {
    if (set.bodyPart === "Rest" || set.exercise === "Rest day") {
      restEntries.push(
        makeRestEntry(
          set.profileId,
          set.note || "Recovery",
          set.date,
          set.id,
        ),
      );
      return;
    }

    workoutEntries.push(
      makeWorkoutEntry(
        set.profileId,
        set.bodyPart || getBodyPartForExercise(set.exercise, "Legs"),
        set.exercise,
        set.weight,
        set.reps,
        set.note,
        set.date,
        set.id,
      ),
    );
  });

  return { workoutEntries, restEntries };
}

function sortEntries(entries: Entry[]) {
  return [...entries].sort((a, b) => {
    const dateSort = b.date.localeCompare(a.date);
    if (dateSort) {
      return dateSort;
    }

    if (a.kind !== b.kind) {
      return a.kind === "workout" ? -1 : 1;
    }

    return b.createdAt.localeCompare(a.createdAt);
  });
}

function profileVolume(entries: WorkoutEntry[]) {
  return entries.reduce((total, entry) => total + entry.weight * entry.reps, 0);
}

function getExerciseProgress(entries: WorkoutEntry[]): ExerciseProgress[] {
  const exercises = Array.from(new Set(entries.map((entry) => entry.exercise))).sort();

  return exercises
    .map((name) => {
      const exerciseEntries = entries.filter((entry) => entry.exercise === name);
      const bestEntry = exerciseEntries.reduce((best, current) => {
        return current.weight * current.reps > best.weight * best.reps
          ? current
          : best;
      }, exerciseEntries[0]);

      return {
        name,
        totalSets: exerciseEntries.length,
        bestVolume: bestEntry.weight * bestEntry.reps,
        bestLabel:
          bestEntry.weight && bestEntry.reps
            ? `${bestEntry.weight} x ${bestEntry.reps}`
            : "Needs details",
        oneRepMax: estimateOneRepMax(bestEntry.weight, bestEntry.reps),
      };
    })
    .sort((a, b) => b.bestVolume - a.bestVolume);
}

function getSetOrder(entry: WorkoutEntry, index: number) {
  const match = entry.note.match(/\b(\d+)\s*(st|nd|rd|th)?\b/i);
  return match ? Number(match[1]) : index + 1;
}

function readLegacyStateFromWindow() {
  if (typeof window === "undefined") {
    return null;
  }

  const raw =
    window.localStorage.getItem(STORAGE_KEY) ||
    window.localStorage.getItem(LEGACY_STORAGE_KEY);
  return raw ? parseLegacySnapshot(raw) : null;
}

export default function Home() {
  const supabase = useMemo(() => createClient(), []);
  const [profiles, setProfiles] = useState<Profile[]>(starterProfiles);
  const [entries, setEntries] = useState<Entry[]>(sortEntries(starterWorkoutEntries));
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
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
  const [editingEntry, setEditingEntry] = useState<EditingEntryDraft | null>(null);

  const activeProfile =
    profiles.find((profile) => profile.id === activeProfileId) || profiles[0];
  const compareProfile =
    profiles.find((profile) => profile.id === compareProfileId) ||
    profiles.find((profile) => profile.id !== activeProfile.id) ||
    activeProfile;

  const activeEntries = useMemo(
    () => entries.filter((entry) => entry.profileId === activeProfile.id),
    [activeProfile.id, entries],
  );
  const activeWorkoutEntries = useMemo(
    () => activeEntries.filter((entry) => !isRestEntry(entry)),
    [activeEntries],
  );
  const compareEntries = useMemo(
    () => entries.filter((entry) => entry.profileId === compareProfile.id),
    [compareProfile.id, entries],
  );
  const compareWorkoutEntries = useMemo(
    () => compareEntries.filter((entry) => !isRestEntry(entry)),
    [compareEntries],
  );
  const catalogExercises = exerciseCatalog[bodyPart as keyof typeof exerciseCatalog];
  const exercises = useMemo(
    () => Array.from(new Set(activeWorkoutEntries.map((entry) => entry.exercise))).sort(),
    [activeWorkoutEntries],
  );

  const filteredEntries = useMemo(() => {
      const visible =
        selectedExercise === "All"
          ? activeEntries
          : activeEntries.filter(
              (entry) => !isRestEntry(entry) && entry.exercise === selectedExercise,
            );

    return sortEntries(visible);
  }, [activeEntries, selectedExercise]);

  const progress = useMemo(
    () => getExerciseProgress(activeWorkoutEntries),
    [activeWorkoutEntries],
  );

  const setBreakdowns = useMemo(() => {
    return progress.map((item) => {
      const exerciseEntries = activeWorkoutEntries
        .filter((entry) => entry.exercise === item.name)
        .sort((a, b) => {
          const dateSort = b.date.localeCompare(a.date);
          return dateSort || getSetOrder(a, 0) - getSetOrder(b, 0);
        });

      return {
        name: item.name,
        bodyPart: exerciseEntries[0]?.bodyPart || getBodyPartForExercise(item.name),
        sets: exerciseEntries,
      };
    });
  }, [activeWorkoutEntries, progress]);

  const previousExerciseEntries = useMemo(() => {
    const matchingEntries = activeWorkoutEntries
      .filter((entry) => entry.exercise === exercise)
      .sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt));
    const lastDate = matchingEntries[0]?.date;

    if (!lastDate) {
      return [];
    }

    return matchingEntries
      .filter((entry) => entry.date === lastDate)
      .sort((a, b) => getSetOrder(a, 0) - getSetOrder(b, 0));
  }, [activeWorkoutEntries, exercise]);

  const comparisonRows = useMemo(() => {
    const leftProgress = getExerciseProgress(activeWorkoutEntries);
    const rightProgress = getExerciseProgress(compareWorkoutEntries);
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
        leader:
          leftMax === rightMax
            ? "Tie"
            : leftMax > rightMax
              ? activeProfile.name
              : compareProfile.name,
      };
    });
  }, [activeProfile.name, activeWorkoutEntries, compareProfile.name, compareWorkoutEntries]);

  const fetchData = useCallback(async (): Promise<{ profiles: Profile[]; entries: Entry[] }> => {
    const [profilesResult, workoutsResult, restResult] = await Promise.all([
      supabase.from("profiles").select("id, name, created_at").order("created_at"),
      supabase
        .from("workout_sets")
        .select("id, profile_id, body_part, exercise, weight, reps, note, workout_date, created_at")
        .order("workout_date", { ascending: false })
        .order("created_at", { ascending: false }),
      supabase
        .from("rest_days")
        .select("id, profile_id, rest_date, note, created_at")
        .order("rest_date", { ascending: false })
        .order("created_at", { ascending: false }),
    ]);

    if (profilesResult.error) {
      throw profilesResult.error;
    }
    if (workoutsResult.error) {
      throw workoutsResult.error;
    }
    if (restResult.error) {
      throw restResult.error;
    }

    let nextProfiles = (profilesResult.data || []).map(mapProfileRow);
    let nextEntries = [
      ...(workoutsResult.data || []).map(mapWorkoutRow),
      ...(restResult.data || []).map(mapRestRow),
    ];

    if (!nextProfiles.length && !nextEntries.length) {
      const legacy = readLegacyStateFromWindow();
      const sourceProfiles = legacy?.profiles || starterProfiles;
      const sourceEntries = legacy
        ? legacyToEntries(legacy)
        : { workoutEntries: starterWorkoutEntries, restEntries: [] };

      const profilesToInsert = sourceProfiles.map((profile) => ({
        id: profile.id,
        name: profile.name,
      }));

      const workoutRowsToInsert = sourceEntries.workoutEntries.map((entry) => ({
        id: entry.id,
        profile_id: entry.profileId,
        body_part: entry.bodyPart,
        exercise: entry.exercise,
        weight: entry.weight,
        reps: entry.reps,
        note: entry.note,
        workout_date: entry.date,
      }));

      const restRowsToInsert = sourceEntries.restEntries.map((entry) => ({
        id: entry.id,
        profile_id: entry.profileId,
        rest_date: entry.date,
        note: entry.note,
      }));

      const insertProfiles = await supabase.from("profiles").upsert(profilesToInsert, {
        onConflict: "id",
      });
      if (insertProfiles.error) {
        throw insertProfiles.error;
      }

      if (workoutRowsToInsert.length) {
        const insertWorkouts = await supabase.from("workout_sets").upsert(workoutRowsToInsert, {
          onConflict: "id",
        });
        if (insertWorkouts.error) {
          throw insertWorkouts.error;
        }
      }

      if (restRowsToInsert.length) {
        const insertRest = await supabase.from("rest_days").upsert(restRowsToInsert, {
          onConflict: "id",
        });
        if (insertRest.error) {
          throw insertRest.error;
        }
      }

      nextProfiles = sourceProfiles;
      nextEntries = sortEntries([...sourceEntries.workoutEntries, ...sourceEntries.restEntries]);
    }

    return {
      profiles: nextProfiles.length ? nextProfiles : starterProfiles,
      entries: sortEntries(nextEntries.length ? nextEntries : starterWorkoutEntries),
    };
  }, [supabase]);

  useEffect(() => {
    let cancelled = false;

    async function run() {
      setLoading(true);
      setError(null);

      try {
        const next = await fetchData();
        if (cancelled) {
          return;
        }
        setProfiles(next.profiles);
        setEntries(next.entries);
      } catch (loadError) {
        console.error(loadError);
        if (!cancelled) {
          setError(
            loadError instanceof Error ? loadError.message : "Failed to load data",
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void run();

    return () => {
      cancelled = true;
    };
  }, [fetchData]);

  function refreshAfterMutation() {
    void (async () => {
      try {
        const next = await fetchData();
        setProfiles(next.profiles);
        setEntries(next.entries);
      } catch (loadError) {
        console.error(loadError);
        setError(loadError instanceof Error ? loadError.message : "Failed to load data");
      }
    })();
  }

  function selectBodyPart(nextBodyPart: string) {
    const nextExercises = exerciseCatalog[nextBodyPart as keyof typeof exerciseCatalog];
    setBodyPart(nextBodyPart);
    setExercise(nextExercises[0]);
    setSelectedExercise("All");
  }

  async function addProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const name = newProfileName.trim();
    if (!name) {
      return;
    }

    const profile: Profile = { id: crypto.randomUUID(), name };
    const { error: insertError } = await supabase.from("profiles").insert({
      id: profile.id,
      name: profile.name,
    });

    if (insertError) {
      setError(insertError.message);
      return;
    }

    setActiveProfileId(profile.id);
    setNewProfileName("");
    refreshAfterMutation();
  }

  async function removeProfile(profileId: string) {
    if (profiles.length <= 1) {
      return;
    }

    const { error: deleteRestError } = await supabase
      .from("rest_days")
      .delete()
      .eq("profile_id", profileId);
    if (deleteRestError) {
      setError(deleteRestError.message);
      return;
    }

    const { error: deleteWorkoutError } = await supabase
      .from("workout_sets")
      .delete()
      .eq("profile_id", profileId);
    if (deleteWorkoutError) {
      setError(deleteWorkoutError.message);
      return;
    }

    const { error: deleteProfileError } = await supabase
      .from("profiles")
      .delete()
      .eq("id", profileId);
    if (deleteProfileError) {
      setError(deleteProfileError.message);
      return;
    }

    if (activeProfile.id === profileId) {
      setActiveProfileId(profiles.find((profile) => profile.id !== profileId)?.id || DEFAULT_PROFILE_ID);
    }
    if (compareProfile.id === profileId) {
      setCompareProfileId(profiles.find((profile) => profile.id !== profileId)?.id || DEFAULT_PROFILE_ID);
    }

    setSelectedExercise("All");
    refreshAfterMutation();
  }

  async function addWorkout(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!exercise.trim()) {
      return;
    }

    const entry = makeWorkoutEntry(
      activeProfile.id,
      bodyPart,
      exercise.trim(),
      Number(weight),
      Number(reps),
      buildSetNote(setNumber, note),
      date,
    );

    const { error: insertError } = await supabase.from("workout_sets").insert({
      id: entry.id,
      profile_id: entry.profileId,
      body_part: entry.bodyPart,
      exercise: entry.exercise,
      weight: entry.weight,
      reps: entry.reps,
      note: entry.note,
      workout_date: entry.date,
    });

    if (insertError) {
      setError(insertError.message);
      return;
    }

    setNote("");
    refreshAfterMutation();
  }

  async function addRestDay() {
    const entry = makeRestEntry(activeProfile.id, restNote.trim() || "Recovery", date);

    const { error: insertError } = await supabase.from("rest_days").insert({
      id: entry.id,
      profile_id: entry.profileId,
      rest_date: entry.date,
      note: entry.note,
    });

    if (insertError) {
      setError(insertError.message);
      return;
    }

    setRestNote("");
    refreshAfterMutation();
  }

  async function importQuickNotes() {
    const importedEntries = parseWorkoutNotes(
      quickNotes,
      date,
      activeProfile.id,
      bodyPart,
    );
    const workoutRows = importedEntries.map((entry) => ({
      id: entry.id,
      profile_id: entry.profileId,
      body_part: entry.bodyPart,
      exercise: entry.exercise,
      weight: entry.weight,
      reps: entry.reps,
      note: entry.note,
      workout_date: entry.date,
    }));

    if (!workoutRows.length) {
      return;
    }

    const { error: insertError } = await supabase.from("workout_sets").insert(workoutRows);
    if (insertError) {
      setError(insertError.message);
      return;
    }

    setQuickNotes("");
    refreshAfterMutation();
  }

  async function deleteEntry(entry: Entry) {
    const table = entry.kind === "rest" ? "rest_days" : "workout_sets";
    const { error } = await supabase.from(table).delete().eq("id", entry.id);
    if (error) {
      setError(error.message);
      return;
    }
    refreshAfterMutation();
  }

  function startEditingEntry(entry: Entry) {
    setEditingEntry({
      id: entry.id,
      kind: entry.kind,
      profileId: entry.profileId,
      bodyPart: entry.bodyPart,
      date: entry.date,
      exercise: entry.exercise,
      weight: String(entry.weight),
      reps: String(entry.reps),
      note: entry.note,
    });
  }

  function updateEditingEntry(field: keyof EditingEntryDraft, value: string) {
    setEditingEntry((current) => {
      if (!current) {
        return current;
      }

      if (field === "bodyPart") {
        if (value === "Rest") {
          return {
            ...current,
            bodyPart: "Rest",
            kind: "rest",
            exercise: "Rest day",
            weight: "0",
            reps: "0",
          };
        }

        const nextExercises = exerciseCatalog[value as keyof typeof exerciseCatalog];
        return {
          ...current,
          bodyPart: value,
          kind: "workout",
          exercise: (nextExercises as readonly string[]).includes(current.exercise)
            ? current.exercise
            : nextExercises[0],
        };
      }

      return { ...current, [field]: value };
    });
  }

  async function saveEditingEntry() {
    if (!editingEntry) {
      return;
    }

    const nextIsRest = editingEntry.kind === "rest" || editingEntry.bodyPart === "Rest";

    if (nextIsRest) {
      const payload = {
        id: editingEntry.id,
        profile_id: editingEntry.profileId,
        rest_date: editingEntry.date,
        note: editingEntry.note.trim() || "Recovery",
      };

      const deleteWorkout = await supabase.from("workout_sets").delete().eq("id", editingEntry.id);
      if (deleteWorkout.error) {
        setError(deleteWorkout.error.message);
        return;
      }

      const { error } = await supabase.from("rest_days").upsert(payload, { onConflict: "id" });
      if (error) {
        setError(error.message);
        return;
      }
    } else {
      const payload = {
        id: editingEntry.id,
        profile_id: editingEntry.profileId,
        body_part: editingEntry.bodyPart,
        exercise: editingEntry.exercise.trim(),
        weight: Number(editingEntry.weight),
        reps: Number(editingEntry.reps),
        note: editingEntry.note.trim(),
        workout_date: editingEntry.date,
      };

      const deleteRest = await supabase.from("rest_days").delete().eq("id", editingEntry.id);
      if (deleteRest.error) {
        setError(deleteRest.error.message);
        return;
      }

      const { error } = await supabase.from("workout_sets").upsert(payload, { onConflict: "id" });
      if (error) {
        setError(error.message);
        return;
      }
    }

    setEditingEntry(null);
    refreshAfterMutation();
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-black text-zinc-100">
        <section className="mx-auto flex min-h-screen max-w-7xl items-center justify-center px-4">
          <p className="text-sm uppercase tracking-[0.2em] text-zinc-500">Loading</p>
        </section>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-black text-zinc-100">
      <section className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-5 sm:px-6 lg:px-8">
        <header className="flex flex-col gap-5 border-b border-zinc-900 pb-5 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-zinc-500">
              Training log
            </p>
            <h1 className="mt-2 text-3xl font-semibold text-white sm:text-4xl">
              Workout tracker
            </h1>
          </div>
          <div className="grid gap-2 sm:grid-cols-3">
            <Metric label="Active" value={activeProfile.name} />
            <Metric label="Sets" value={activeWorkoutEntries.length.toString()} />
            <Metric label="Volume" value={profileVolume(activeWorkoutEntries).toLocaleString()} />
          </div>
        </header>

        {error ? (
          <div className="rounded-md border border-red-900 bg-red-950 px-4 py-3 text-sm text-red-200">
            {error}
          </div>
        ) : null}

        <section className="grid gap-3 rounded-md border border-zinc-900 bg-zinc-950 p-4 lg:grid-cols-[1fr_320px]">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-zinc-600">
              Profiles
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              {profiles.map((profile) => (
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
                    onClick={() => void removeProfile(profile.id)}
                    disabled={profiles.length <= 1}
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
          <form onSubmit={(event) => void addProfile(event)} className="flex gap-2">
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
              onSubmit={(event) => void addWorkout(event)}
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
                    {previousExerciseEntries[0]?.date || "No history"}
                  </span>
                </div>
                <div className="mt-3 grid gap-2">
                  {previousExerciseEntries.length ? (
                    previousExerciseEntries.map((entry, index) => (
                      <div
                        key={entry.id}
                        className="grid grid-cols-[56px_1fr_72px] gap-2 rounded-md border border-zinc-900 px-3 py-2 text-sm"
                      >
                        <span className="text-zinc-500">
                          Set {getSetOrder(entry, index)}
                        </span>
                        <span className="font-semibold text-zinc-100">
                          {entry.weight || "-"} x {entry.reps || "-"}
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            setWeight(String(entry.weight));
                            setReps(String(entry.reps));
                            setSetNumber(String(getSetOrder(entry, index)));
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
              <h2 className="text-base font-semibold text-white">Rest day</h2>
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
                onClick={() => void addRestDay()}
                className="mt-4 h-11 w-full rounded-md border border-zinc-700 px-4 text-sm font-semibold text-zinc-100 transition hover:border-zinc-400 hover:bg-zinc-900"
              >
                Mark rest day
              </button>
            </section>

            <section className="rounded-md border border-zinc-900 bg-zinc-950 p-4">
              <h2 className="text-base font-semibold text-white">Paste notes</h2>
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
                onClick={() => void importQuickNotes()}
                className="mt-3 h-11 w-full rounded-md border border-zinc-700 px-4 text-sm font-semibold text-zinc-100 transition hover:border-zinc-400 hover:bg-zinc-900"
              >
                Import notes
              </button>
            </section>

            <section className="rounded-md border border-zinc-900 bg-zinc-950 p-4">
              <h2 className="text-base font-semibold text-white">Exercise list</h2>
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
                      {exerciseCatalog[part as keyof typeof exerciseCatalog].map(
                        (catalogExercise) => (
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
                        ),
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          </section>

          <section className="space-y-4">
            <div className="rounded-md border border-zinc-900 bg-zinc-950 p-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <h2 className="text-base font-semibold text-white">Compare</h2>
                <select
                  value={compareProfile.id}
                  onChange={(event) => setCompareProfileId(event.target.value)}
                  className={selectClassName}
                >
                  {profiles
                    .filter((profile) => profile.id !== activeProfile.id)
                    .map((profile) => (
                      <option key={profile.id} value={profile.id}>
                        {profile.name}
                      </option>
                    ))}
                  {profiles.length === 1 && (
                    <option value={activeProfile.id}>{activeProfile.name}</option>
                  )}
                </select>
              </div>

              <div className="mt-4 grid gap-3 sm:grid-cols-3">
                <CompareMetric
                  label="Volume"
                  left={profileVolume(activeWorkoutEntries).toLocaleString()}
                  right={profileVolume(compareWorkoutEntries).toLocaleString()}
                />
                <CompareMetric
                  label="Sets"
                  left={activeWorkoutEntries.length.toString()}
                  right={compareWorkoutEntries.length.toString()}
                />
                <CompareMetric
                  label="Exercises"
                  left={new Set(activeWorkoutEntries.map((entry) => entry.exercise)).size.toString()}
                  right={new Set(compareWorkoutEntries.map((entry) => entry.exercise)).size.toString()}
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
                  <h3 className="text-sm font-semibold text-white">{item.name}</h3>
                  <dl className="mt-4 grid grid-cols-3 gap-2 text-sm">
                    <Stat label="Best" value={item.bestLabel} />
                    <Stat label="Est. max" value={String(item.oneRepMax)} />
                    <Stat label="Sets" value={String(item.totalSets)} />
                  </dl>
                </article>
              ))}
            </div>

            <div className="rounded-md border border-zinc-900 bg-zinc-950 p-4">
              <h2 className="text-base font-semibold text-white">Set breakdown</h2>
              <div className="mt-4 grid gap-3 md:grid-cols-2">
                {setBreakdowns.map((item) => (
                  <article
                    key={item.name}
                    className="rounded-md border border-zinc-900 bg-black p-3"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <h3 className="text-sm font-semibold text-white">{item.name}</h3>
                      <span className="rounded-md border border-zinc-800 px-2 py-1 text-xs font-semibold text-zinc-400">
                        {item.bodyPart}
                      </span>
                    </div>
                    <div className="mt-3 grid gap-2">
                      {item.sets.map((entry, index) => (
                        <div
                          key={entry.id}
                          className="grid grid-cols-[56px_1fr_72px] gap-2 rounded-md border border-zinc-900 px-3 py-2 text-sm"
                        >
                          <span className="text-zinc-500">Set {getSetOrder(entry, index)}</span>
                          <span className="font-semibold text-zinc-100">
                            {entry.weight || "-"} x {entry.reps || "-"}
                          </span>
                          <span className="text-right text-zinc-500">
                            {entry.date.slice(5)}
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
                  <span>Date</span>
                  <span>Person</span>
                  <span>Part</span>
                  <span>Exercise</span>
                  <span>Weight</span>
                  <span>Reps</span>
                  <span>Note</span>
                  <span></span>
                </div>
                {filteredEntries.map((entry) => (
                  <div
                    key={entry.id}
                    className="grid grid-cols-[92px_106px_96px_1fr_74px_58px_1fr_118px] gap-3 border-b border-zinc-900 px-4 py-3 text-sm text-zinc-200 last:border-b-0"
                  >
                    {editingEntry?.id === entry.id ? (
                      <>
                        <input
                          type="date"
                          value={editingEntry.date}
                          onChange={(event) =>
                            updateEditingEntry("date", event.target.value)
                          }
                          className={compactInputClassName}
                        />
                        <select
                          value={editingEntry.profileId}
                          onChange={(event) =>
                            updateEditingEntry("profileId", event.target.value)
                          }
                          className={compactSelectClassName}
                        >
                          {profiles.map((profile) => (
                            <option key={profile.id} value={profile.id}>
                              {profile.name}
                            </option>
                          ))}
                        </select>
                        <select
                          value={editingEntry.bodyPart}
                          onChange={(event) =>
                            updateEditingEntry("bodyPart", event.target.value)
                          }
                          className={compactSelectClassName}
                        >
                          {editableBodyParts.map((part) => (
                            <option key={part}>{part}</option>
                          ))}
                        </select>
                        {editingEntry.kind === "rest" || editingEntry.bodyPart === "Rest" ? (
                          <input value="Rest day" readOnly className={compactInputClassName} />
                        ) : (
                          <select
                            value={editingEntry.exercise}
                            onChange={(event) =>
                              updateEditingEntry("exercise", event.target.value)
                            }
                            className={compactSelectClassName}
                          >
                            {exerciseCatalog[
                              editingEntry.bodyPart as keyof typeof exerciseCatalog
                            ].map((catalogExercise) => (
                              <option key={catalogExercise}>{catalogExercise}</option>
                            ))}
                          </select>
                        )}
                        <input
                          type="number"
                          min="0"
                          step="0.5"
                          value={editingEntry.weight}
                          onChange={(event) =>
                            updateEditingEntry("weight", event.target.value)
                          }
                          className={compactInputClassName}
                        />
                        <input
                          type="number"
                          min="0"
                          value={editingEntry.reps}
                          onChange={(event) =>
                            updateEditingEntry("reps", event.target.value)
                          }
                          className={compactInputClassName}
                        />
                        <input
                          value={editingEntry.note}
                          onChange={(event) =>
                            updateEditingEntry("note", event.target.value)
                          }
                          className={compactInputClassName}
                          placeholder="Note"
                        />
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => void saveEditingEntry()}
                            className="h-8 flex-1 rounded-md bg-white px-2 text-xs font-semibold text-black transition hover:bg-zinc-200"
                          >
                            Save
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditingEntry(null)}
                            className="h-8 flex-1 rounded-md border border-zinc-800 px-2 text-xs font-semibold text-zinc-400 transition hover:border-zinc-500"
                          >
                            Cancel
                          </button>
                        </div>
                      </>
                    ) : (
                      <>
                        <span className="text-zinc-500">{entry.date}</span>
                        <span className="truncate rounded-md border border-zinc-800 px-2 py-1 text-xs font-semibold text-zinc-300">
                          {profiles.find((profile) => profile.id === entry.profileId)?.name || "Unknown"}
                        </span>
                        <span className="truncate text-zinc-500">{entry.bodyPart}</span>
                        <span className="font-medium text-white">{entry.exercise}</span>
                        <span>{entry.weight || "-"}</span>
                        <span>{entry.reps || "-"}</span>
                        <span className="text-zinc-500">{entry.note || "-"}</span>
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => startEditingEntry(entry)}
                            className="h-8 flex-1 rounded-md border border-zinc-800 px-2 text-xs font-semibold text-zinc-300 transition hover:border-zinc-500"
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => void deleteEntry(entry)}
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

function mapProfileRow(row: ProfileRow): Profile {
  return {
    id: row.id,
    name: row.name,
  };
}

function mapWorkoutRow(row: WorkoutRow): WorkoutEntry {
  return {
    kind: "workout",
    id: row.id,
    profileId: row.profile_id,
    bodyPart: row.body_part,
    date: row.workout_date,
    exercise: row.exercise,
    weight: Number(row.weight),
    reps: Number(row.reps),
    note: row.note,
    createdAt: row.created_at,
  };
}

function mapRestRow(row: RestRow): RestEntry {
  return {
    kind: "rest",
    id: row.id,
    profileId: row.profile_id,
    bodyPart: "Rest",
    date: row.rest_date,
    exercise: "Rest day",
    weight: 0,
    reps: 0,
    note: row.note,
    createdAt: row.created_at,
  };
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
