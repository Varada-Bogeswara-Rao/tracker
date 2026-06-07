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
  createdAt: string;
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
    "Cable flyes upper chest",
    "Cable flyes lower chest",
  ],
  Triceps: [
    "Cable tricep extensions",
    "Overhead cable extensions",
    "Single arm cable extensions",
  ],
  Back: [
    "Lat pulldowns",
    "Chest-supported dumbbell rows",
    "Lat prayers",
    "Seated cable rows",
  ],
  Biceps: [
    "Seated dumbbell curls",
    "Standing barbell curls",
    "Preacher curls",
    "Incline dumbbell curls",
    "Dumbbell hammer curls",
    "Cable bicep curls",
  ],
  Shoulders: [
    "Dumbbell shoulder press",
    "Dumbbell lateral raises",
    "Cable lateral raises",
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

function formatEntryTime(createdAtString: string): string {
  if (!createdAtString) return "";
  try {
    const date = new Date(createdAtString);
    if (isNaN(date.getTime())) return "";
    return date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  } catch {
    return "";
  }
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

function getBodyPartForExercise(exercise: string, catalog: Record<string, readonly string[]> = exerciseCatalog, fallback = "Legs") {
  const normalizedExercise = normalizeExercise(exercise);
  const match = Object.keys(catalog).find((bodyPart) =>
    catalog[bodyPart].some(
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
  catalog: Record<string, readonly string[]> = exerciseCatalog,
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
            getBodyPartForExercise(currentExercise, catalog, fallbackBodyPart),
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
          getBodyPartForExercise(currentExercise, catalog, fallbackBodyPart),
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

function legacyToEntries(legacy: LegacyState, catalog: Record<string, readonly string[]> = exerciseCatalog) {
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
        set.bodyPart || getBodyPartForExercise(set.exercise, catalog, "Legs"),
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

type GroupedItem =
  | { kind: "rest"; entry: RestEntry }
  | { kind: "single"; entry: WorkoutEntry }
  | {
      kind: "dropset";
      exercise: string;
      setNumber: number;
      entries: WorkoutEntry[];
      bodyPart: string;
      profileId: string;
    };

function groupDateEntries(dateEntries: Entry[]): GroupedItem[] {
  const restEntries = dateEntries.filter(isRestEntry) as RestEntry[];
  const workoutEntries = dateEntries.filter((e) => !isRestEntry(e)) as WorkoutEntry[];

  // Group workout entries by profileId + exercise + setNumber
  const groups: Record<string, WorkoutEntry[]> = {};
  workoutEntries.forEach((entry, idx) => {
    const setNum = getSetOrder(entry, idx);
    const key = `${entry.profileId}|${entry.exercise}|${setNum}`;
    if (!groups[key]) {
      groups[key] = [];
    }
    groups[key].push(entry);
  });

  const items: GroupedItem[] = [];

  // Add rest entries first to match the existing display
  restEntries.forEach((entry) => {
    items.push({ kind: "rest", entry });
  });

  // To preserve original order, scan workout entries and add their corresponding group
  const seenKeys = new Set<string>();
  workoutEntries.forEach((entry, idx) => {
    const setNum = getSetOrder(entry, idx);
    const key = `${entry.profileId}|${entry.exercise}|${setNum}`;
    if (seenKeys.has(key)) {
      return;
    }
    seenKeys.add(key);

    const groupEntries = groups[key];
    if (groupEntries.length > 1) {
      items.push({
        kind: "dropset",
        exercise: entry.exercise,
        setNumber: setNum,
        entries: groupEntries,
        bodyPart: entry.bodyPart,
        profileId: entry.profileId,
      });
    } else {
      items.push({
        kind: "single",
        entry: groupEntries[0],
      });
    }
  });

  return items;
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

type ProfileTheme = {
  accent: string;
  nameColor: string;
  button: string;
  outlineButton: string;
  activeTab: string;
  inputFocus: string;
  badge: string;
  borderLeft: string;
  dot: string;
  text: string;
  lightBg: string;
};

const profileThemes: ProfileTheme[] = [
  {
    accent: "violet",
    nameColor: "text-violet-400",
    button: "bg-violet-600 hover:bg-violet-500 text-white shadow-[0_0_15px_rgba(139,92,246,0.3)]",
    outlineButton: "border-violet-850/60 bg-violet-950/15 text-violet-400 hover:border-violet-700 hover:bg-violet-950/30",
    activeTab: "border-violet-500 bg-violet-500/10 text-violet-300 font-bold",
    inputFocus: "focus:border-violet-500/80 focus:ring-1 focus:ring-violet-500/20",
    badge: "bg-violet-950/30 text-violet-400 border border-violet-850/35",
    borderLeft: "border-l-2 border-l-violet-500/60",
    dot: "bg-violet-400 shadow-[0_0_8px_rgba(167,139,250,0.7)]",
    text: "text-violet-400",
    lightBg: "bg-violet-950/5"
  },
  {
    accent: "teal",
    nameColor: "text-teal-400",
    button: "bg-teal-600 hover:bg-teal-500 text-white shadow-[0_0_15px_rgba(20,184,166,0.3)]",
    outlineButton: "border-teal-850/60 bg-teal-950/15 text-teal-400 hover:border-teal-700 hover:bg-teal-950/30",
    activeTab: "border-teal-500 bg-teal-500/10 text-teal-300 font-bold",
    inputFocus: "focus:border-teal-500/80 focus:ring-1 focus:ring-teal-500/20",
    badge: "bg-teal-950/30 text-teal-400 border border-teal-850/35",
    borderLeft: "border-l-2 border-l-teal-500/60",
    dot: "bg-teal-400 shadow-[0_0_8px_rgba(45,212,191,0.7)]",
    text: "text-teal-400",
    lightBg: "bg-teal-950/5"
  },
  {
    accent: "rose",
    nameColor: "text-rose-400",
    button: "bg-rose-600 hover:bg-rose-500 text-white shadow-[0_0_15px_rgba(244,63,94,0.3)]",
    outlineButton: "border-rose-850/60 bg-rose-950/15 text-rose-400 hover:border-rose-700 hover:bg-rose-950/30",
    activeTab: "border-rose-500 bg-rose-500/10 text-rose-300 font-bold",
    inputFocus: "focus:border-rose-500/80 focus:ring-1 focus:ring-rose-500/20",
    badge: "bg-rose-950/30 text-rose-400 border border-rose-850/35",
    borderLeft: "border-l-2 border-l-rose-500/60",
    dot: "bg-rose-400 shadow-[0_0_8px_rgba(251,113,133,0.7)]",
    text: "text-rose-400",
    lightBg: "bg-rose-950/5"
  },
  {
    accent: "amber",
    nameColor: "text-amber-400",
    button: "bg-amber-600 hover:bg-amber-500 text-white shadow-[0_0_15px_rgba(245,158,11,0.3)]",
    outlineButton: "border-amber-850/60 bg-amber-950/15 text-amber-400 hover:border-amber-700 hover:bg-amber-950/30",
    activeTab: "border-amber-500 bg-amber-500/10 text-amber-300 font-bold",
    inputFocus: "focus:border-amber-500/80 focus:ring-1 focus:ring-amber-500/20",
    badge: "bg-amber-950/30 text-amber-400 border border-amber-850/35",
    borderLeft: "border-l-2 border-l-amber-500/60",
    dot: "bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.7)]",
    text: "text-amber-400",
    lightBg: "bg-amber-950/5"
  }
];

function getProfileTheme(profileId: string, profilesList: Profile[]): ProfileTheme {
  const index = profilesList.findIndex((p) => p.id === profileId);
  const themeIndex = index >= 0 ? index % profileThemes.length : 0;
  return profileThemes[themeIndex];
}

export default function Home() {
  const supabase = useMemo(() => createClient(), []);
  const [profiles, setProfiles] = useState<Profile[]>(starterProfiles);
  const [entries, setEntries] = useState<Entry[]>(sortEntries(starterWorkoutEntries));
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [mobileTab, setMobileTab] = useState<"log" | "history" | "analytics">("log");
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

  const [customExercises, setCustomExercises] = useState<Record<string, string[]>>({});
  const [isCustomExerciseMode, setIsCustomExerciseMode] = useState(false);
  const [customExerciseName, setCustomExerciseName] = useState("");

  const [confirmConfig, setConfirmConfig] = useState<{
    title: string;
    message: string;
    confirmText?: string;
    cancelText?: string;
    isDanger?: boolean;
    onConfirm: () => void;
  } | null>(null);
  const [toast, setToast] = useState<{ message: string; type: "success" | "info" | "error" } | null>(null);

  function showToast(message: string, type: "success" | "info" | "error" = "success") {
    setToast({ message, type });
  }

  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  const copySuccess = toast?.message === "Workout history copied for AI!";

  function copyAISummary() {
    const profileName = activeProfile.name;
    let summaryText = `WORKOUT TRACKER HISTORY FOR ${profileName.toUpperCase()}\n`;
    summaryText += `==========================================\n\n`;

    if (groupedEntriesByDate.length === 0) {
      summaryText += "No workouts logged yet.";
    } else {
      groupedEntriesByDate.forEach((day) => {
        const dayLabel = day.isRest ? "Rest Day" : `${day.bodyParts.join(" & ")} Day`;
        summaryText += `- ${day.date} [${dayLabel}]\n`;
        if (day.isRest) {
          summaryText += `  * Rest: ${day.restNote || "Recovery"}\n`;
        } else {
          // Sort workout entries chronologically (oldest first)
          const workoutEntries = day.entries
            .filter((e): e is WorkoutEntry => e.kind === "workout")
            .sort((a, b) => a.createdAt.localeCompare(b.createdAt));

          const exerciseMap: Record<string, WorkoutEntry[]> = {};
          const exerciseOrder: string[] = [];

          workoutEntries.forEach((e) => {
            if (!exerciseMap[e.exercise]) {
              exerciseMap[e.exercise] = [];
              exerciseOrder.push(e.exercise);
            }
            exerciseMap[e.exercise].push(e);
          });

          exerciseOrder.forEach((exName) => {
            const sets = exerciseMap[exName];
            // Sort sets chronologically
            sets.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
            const setsText = sets
              .map((s, idx) => {
                const setNum = getSetOrder(s, idx);
                const details = s.weight ? `${s.weight}kg x ${s.reps} reps` : `${s.reps} reps`;
                const notePart = s.note ? ` (${s.note})` : "";
                const timeStr = formatEntryTime(s.createdAt);
                const timePart = timeStr ? ` (${timeStr})` : "";
                return `Set ${setNum}${timePart}: ${details}${notePart}`;
              })
              .join(", ");
            summaryText += `  * ${exName}: ${setsText}\n`;
          });
        }
        summaryText += `\n`;
      });
    }

    if (typeof navigator !== "undefined" && navigator.clipboard) {
      void navigator.clipboard.writeText(summaryText);
      showToast("Workout history copied for AI!", "success");
    }
  }

  useEffect(() => {
    if (typeof window !== "undefined") {
      const stored = window.localStorage.getItem("gym-workout-tracker-custom-exercises");
      if (stored) {
        try {
          setCustomExercises(JSON.parse(stored));
        } catch (e) {
          console.error(e);
        }
      }
    }
  }, []);

  const discoveredCustomExercises = useMemo(() => {
    const discovered: Record<string, string[]> = {};
    entries.forEach((entry) => {
      if (entry.kind === "workout") {
        const cat = exerciseCatalog[entry.bodyPart as keyof typeof exerciseCatalog];
        if (cat && !(cat as readonly string[]).includes(entry.exercise)) {
          if (!discovered[entry.bodyPart]) {
            discovered[entry.bodyPart] = [];
          }
          if (!discovered[entry.bodyPart].includes(entry.exercise)) {
            discovered[entry.bodyPart].push(entry.exercise);
          }
        }
      }
    });
    return discovered;
  }, [entries]);

  const fullExerciseCatalog = useMemo(() => {
    const combined: Record<string, string[]> = {};
    Object.keys(exerciseCatalog).forEach((key) => {
      const discovered = discoveredCustomExercises[key] || [];
      const local = customExercises[key] || [];
      const uniqueCustom = Array.from(new Set([...local, ...discovered]));
      combined[key] = [
        ...exerciseCatalog[key as keyof typeof exerciseCatalog],
        ...uniqueCustom,
      ];
    });
    return combined;
  }, [customExercises, discoveredCustomExercises]);

  function addCustomExercise(bodyPart: string, name: string) {
    const cleanName = name.trim();
    if (!cleanName) return;

    setCustomExercises((prev) => {
      const currentList = prev[bodyPart] || [];
      if (
        currentList.includes(cleanName) ||
        (exerciseCatalog[bodyPart as keyof typeof exerciseCatalog] as readonly string[])?.includes(cleanName)
      ) {
        return prev;
      }
      const next = {
        ...prev,
        [bodyPart]: [...currentList, cleanName],
      };
      if (typeof window !== "undefined") {
        window.localStorage.setItem("gym-workout-tracker-custom-exercises", JSON.stringify(next));
      }
      return next;
    });
  }

  const activeProfile =
    profiles.find((profile) => profile.id === activeProfileId) || profiles[0];
  const compareProfile =
    profiles.find((profile) => profile.id === compareProfileId) ||
    profiles.find((profile) => profile.id !== activeProfile.id) ||
    activeProfile;

  const activeTheme = useMemo(() => getProfileTheme(activeProfile.id, profiles), [activeProfile.id, profiles]);

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
  const catalogExercises = fullExerciseCatalog[bodyPart] || [];
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

  const [expandedDates, setExpandedDates] = useState<Record<string, boolean>>({});

  function toggleDateExpanded(date: string) {
    setExpandedDates((prev) => ({
      ...prev,
      [date]: prev[date] === false ? true : false,
    }));
  }

  const groupedEntriesByDate = useMemo(() => {
    const groupsMap: Record<string, Entry[]> = {};
    filteredEntries.forEach((entry) => {
      if (!groupsMap[entry.date]) {
        groupsMap[entry.date] = [];
      }
      groupsMap[entry.date].push(entry);
    });

    const sortedDates = Object.keys(groupsMap).sort((a, b) => b.localeCompare(a));

    return sortedDates.map((date) => {
      const dateEntries = groupsMap[date];
      const restEntry = dateEntries.find(isRestEntry) as RestEntry | undefined;

      let bodyPartsList: string[] = [];
      let isRest = false;
      let restNote = "";

      if (restEntry) {
        isRest = true;
        restNote = restEntry.note;
        bodyPartsList = ["Rest"];
      } else {
        bodyPartsList = Array.from(new Set(dateEntries.map((e) => e.bodyPart)));
        const hasTriceps = bodyPartsList.some((bp) => bp.toLowerCase() === "triceps");
        const hasBiceps = bodyPartsList.some((bp) => bp.toLowerCase() === "biceps");
        if (hasTriceps && hasBiceps) {
          bodyPartsList = bodyPartsList.map((bp) => {
            const lower = bp.toLowerCase();
            if (lower === "triceps" || lower === "biceps") {
              return "Arm";
            }
            return bp;
          });
          bodyPartsList = Array.from(new Set(bodyPartsList));
        }
      }

      const groupedItems = groupDateEntries(dateEntries);

      return {
        date,
        isRest,
        restNote,
        bodyParts: bodyPartsList,
        entries: dateEntries,
        groupedItems,
      };
    });
  }, [filteredEntries]);

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
        bodyPart: exerciseEntries[0]?.bodyPart || getBodyPartForExercise(item.name, fullExerciseCatalog),
        sets: exerciseEntries,
      };
    });
  }, [activeWorkoutEntries, progress, fullExerciseCatalog]);

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
        ? legacyToEntries(legacy, exerciseCatalog)
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
        created_at: entry.createdAt,
      }));

      const restRowsToInsert = sourceEntries.restEntries.map((entry) => ({
        id: entry.id,
        profile_id: entry.profileId,
        rest_date: entry.date,
        note: entry.note,
        created_at: entry.createdAt,
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
    showToast(`Profile "${name}" created!`, "success");
  }

  async function removeProfile(profileId: string) {
    if (profiles.length <= 1) {
      return;
    }

    const profileName = profiles.find((p) => p.id === profileId)?.name || "this user";
    
    setConfirmConfig({
      title: "Remove Profile",
      message: `Are you sure you want to remove "${profileName}" and all of their logged workouts and rest days? This action cannot be undone.`,
      isDanger: true,
      confirmText: "Remove Profile",
      onConfirm: async () => {
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
        showToast("Profile removed!", "info");
      }
    });
  }

  async function addWorkout(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const exerciseName = isCustomExerciseMode ? customExerciseName.trim() : exercise.trim();
    if (!exerciseName) {
      return;
    }

    const entry = makeWorkoutEntry(
      activeProfile.id,
      bodyPart,
      exerciseName,
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
      created_at: entry.createdAt,
    });

    if (insertError) {
      setError(insertError.message);
      return;
    }

    if (isCustomExerciseMode) {
      addCustomExercise(bodyPart, exerciseName);
      setIsCustomExerciseMode(false);
      setCustomExerciseName("");
    }

    setNote("");
    refreshAfterMutation();
    showToast("Set logged successfully!", "success");
  }

  async function addRestDay() {
    const entry = makeRestEntry(activeProfile.id, restNote.trim() || "Recovery", date);

    const { error: insertError } = await supabase.from("rest_days").upsert({
      id: entry.id,
      profile_id: entry.profileId,
      rest_date: entry.date,
      note: entry.note,
      created_at: entry.createdAt,
    }, {
      onConflict: "profile_id,rest_date"
    });

    if (insertError) {
      setError(insertError.message);
      return;
    }

    setRestNote("");
    refreshAfterMutation();
    showToast("Rest day marked!", "info");
  }

  async function deleteEntry(entry: Entry) {
    const isRest = entry.kind === "rest";
    const label = isRest ? "rest day" : `${entry.exercise} set`;
    
    setConfirmConfig({
      title: "Delete Entry",
      message: `Are you sure you want to delete this ${label}? This action cannot be undone.`,
      isDanger: true,
      confirmText: "Delete",
      onConfirm: async () => {
        const table = isRest ? "rest_days" : "workout_sets";
        const { error } = await supabase.from(table).delete().eq("id", entry.id);
        if (error) {
          setError(error.message);
          return;
        }
        refreshAfterMutation();
        showToast("Set deleted successfully!", "info");
      }
    });
  }

  function startEditingEntry(entry: Entry) {
    const isRest = entry.kind === "rest";
    const label = isRest ? "rest day" : `${entry.exercise} set`;

    setConfirmConfig({
      title: "Edit Entry",
      message: `Are you sure you want to edit this ${label}?`,
      isDanger: false,
      confirmText: "Edit",
      onConfirm: () => {
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
          createdAt: entry.createdAt,
        });
      }
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

        const nextExercises = fullExerciseCatalog[value] || [];
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
        created_at: editingEntry.createdAt,
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
        created_at: editingEntry.createdAt,
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
    showToast("Set updated successfully!", "success");
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
    <main className="min-h-screen w-full overflow-x-hidden bg-black text-zinc-100">
      <section className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
        <header className="flex flex-col gap-5 border-b border-zinc-900 pb-5 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-zinc-500">
              Training log
            </p>
            <h1 className="mt-2 text-3xl font-semibold text-white sm:text-4xl">
              Workout tracker
            </h1>
          </div>
          <div className="grid grid-cols-3 gap-2 md:gap-3">
            <Metric label="Active" value={activeProfile.name} valueClassName={activeTheme.nameColor} />
            <Metric label="Sets" value={activeWorkoutEntries.length.toString()} />
            <Metric label="Volume" value={profileVolume(activeWorkoutEntries).toLocaleString()} />
          </div>
        </header>

        {error ? (
          <div className="rounded-md border border-red-900 bg-red-950 px-4 py-3 text-sm text-red-200">
            {error}
          </div>
        ) : null}

        {/* Premium Mobile Tab Selector */}
        <div className="flex lg:hidden p-1.5 rounded-xl bg-zinc-900/60 border border-zinc-800/40 backdrop-blur-md">
          <button
            type="button"
            onClick={() => setMobileTab("log")}
            className={`flex-1 flex flex-col items-center justify-center py-2 rounded-lg text-[11px] font-bold tracking-wide transition-all ${
              mobileTab === "log"
                ? "bg-white text-black shadow-md shadow-black/10 scale-[1.02]"
                : "text-zinc-400 hover:text-zinc-200"
            }`}
          >
            <svg className="w-4 h-4 mb-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
            Log Set
          </button>
          <button
            type="button"
            onClick={() => setMobileTab("history")}
            className={`flex-1 flex flex-col items-center justify-center py-2 rounded-lg text-[11px] font-bold tracking-wide transition-all ${
              mobileTab === "history"
                ? "bg-white text-black shadow-md shadow-black/10 scale-[1.02]"
                : "text-zinc-400 hover:text-zinc-200"
            }`}
          >
            <svg className="w-4 h-4 mb-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            History
          </button>
          <button
            type="button"
            onClick={() => setMobileTab("analytics")}
            className={`flex-1 flex flex-col items-center justify-center py-2 rounded-lg text-[11px] font-bold tracking-wide transition-all ${
              mobileTab === "analytics"
                ? "bg-white text-black shadow-md shadow-black/10 scale-[1.02]"
                : "text-zinc-400 hover:text-zinc-200"
            }`}
          >
            <svg className="w-4 h-4 mb-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
            Analytics
          </button>
        </div>

        {/* Profiles Section */}
        <section className={`grid gap-4 rounded-xl border border-zinc-800/60 bg-zinc-900/10 backdrop-blur-md p-4 lg:grid-cols-[1fr_320px] ${
          mobileTab === "analytics" ? "hidden lg:grid" : "grid"
        }`}>
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-zinc-500">
              Profiles
            </p>
            <div className="mt-3 flex gap-2 overflow-x-auto pb-1.5 scrollbar-none">
              {profiles.map((profile) => {
                const pTheme = getProfileTheme(profile.id, profiles);
                const isActive = profile.id === activeProfile.id;
                return (
                  <div
                    key={profile.id}
                    className={`flex h-10 items-center overflow-hidden rounded-lg border transition ${
                      isActive
                        ? `${pTheme.activeTab}`
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
                        isActive
                          ? "border-zinc-700/50 text-zinc-400 hover:bg-zinc-950/30"
                          : "border-zinc-800 text-zinc-500 hover:text-red-400 disabled:text-zinc-800"
                      }`}
                    >
                      Remove
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
          <form onSubmit={(event) => void addProfile(event)} className="flex gap-2">
            <input
              value={newProfileName}
              onChange={(event) => setNewProfileName(event.target.value)}
              className="h-10 min-w-0 flex-1 rounded-lg border border-zinc-800 bg-black/60 px-3 text-sm text-zinc-100 outline-none transition placeholder:text-zinc-700 focus:border-zinc-500 focus:ring-1 focus:ring-zinc-800"
              placeholder="Add friend"
            />
            <button className="h-10 rounded-lg border border-zinc-700 px-4 text-sm font-semibold text-zinc-100 transition hover:border-zinc-400 hover:bg-zinc-900/50">
              Add
            </button>
          </form>
        </section>

        <div className="grid gap-6 lg:grid-cols-[390px_1fr]">
          {/* Left Column: Logging Inputs (Add Set, Rest Day, Notes, Exercises) */}
          <section className={`space-y-4 lg:block ${mobileTab === "log" ? "block" : "hidden"}`}>
            <form
              onSubmit={(event) => void addWorkout(event)}
              className="rounded-xl border border-zinc-800/60 bg-zinc-900/10 backdrop-blur-md p-4"
            >
              <h2 className="text-base font-semibold text-white">
                Add set for <span className={activeTheme.nameColor}>{activeProfile.name}</span>
              </h2>
              <div className="mt-4 grid gap-3.5">
                <FieldLabel label="Date">
                  <input
                    type="date"
                    value={date}
                    onChange={(event) => setDate(event.target.value)}
                    className={`${inputClassName} bg-black/50 border-zinc-800/80 ${activeTheme.inputFocus}`}
                  />
                </FieldLabel>
                <FieldLabel label="Body part">
                  <select
                    value={bodyPart}
                    onChange={(event) => selectBodyPart(event.target.value)}
                    className={`${selectClassName} bg-black/50 border-zinc-800/80 ${activeTheme.inputFocus}`}
                  >
                    {bodyParts.map((part) => (
                      <option key={part}>{part}</option>
                    ))}
                  </select>
                </FieldLabel>
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs font-medium uppercase tracking-[0.14em] text-zinc-500">Exercise</span>
                    <button
                      type="button"
                      onClick={() => {
                        setIsCustomExerciseMode(!isCustomExerciseMode);
                        setCustomExerciseName("");
                      }}
                      className={`text-xs font-semibold hover:opacity-80 transition ${activeTheme.text}`}
                    >
                      {isCustomExerciseMode ? "Choose Existing" : "+ Add Custom"}
                    </button>
                  </div>
                  {isCustomExerciseMode ? (
                    <input
                      value={customExerciseName}
                      onChange={(event) => setCustomExerciseName(event.target.value)}
                      className={`${inputClassName} w-full bg-black/50 border-zinc-800/80 ${activeTheme.inputFocus}`}
                      placeholder="e.g., Incline Cable Fly"
                      required
                    />
                  ) : (
                    <select
                      value={exercise}
                      onChange={(event) => setExercise(event.target.value)}
                      className={`${selectClassName} w-full bg-black/50 border-zinc-800/80 ${activeTheme.inputFocus}`}
                    >
                      {catalogExercises.map((catalogExercise) => (
                        <option key={catalogExercise}>{catalogExercise}</option>
                      ))}
                    </select>
                  )}
                </div>
                <div>
                  <p className="text-xs font-medium uppercase tracking-[0.14em] text-zinc-500">
                    Set number
                  </p>
                  <div className="mt-1.5 grid grid-cols-5 gap-1.5">
                    {["1", "2", "3", "4", "5"].map((number) => (
                      <button
                        key={number}
                        type="button"
                        onClick={() => setSetNumber(number)}
                        className={`h-10 rounded-lg border text-sm font-semibold transition ${
                          setNumber === number
                            ? "border-white bg-white text-black"
                            : "border-zinc-800 bg-black/40 text-zinc-400 hover:border-zinc-500 hover:text-white"
                        }`}
                      >
                        {number}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <FieldLabel label="Weight (kg)">
                    <input
                      type="number"
                      min="0"
                      step="0.5"
                      value={weight}
                      onChange={(event) => setWeight(event.target.value)}
                      className={`${inputClassName} bg-black/50 border-zinc-800/80 ${activeTheme.inputFocus}`}
                    />
                  </FieldLabel>
                  <FieldLabel label="Reps">
                    <input
                      type="number"
                      min="0"
                      value={reps}
                      onChange={(event) => setReps(event.target.value)}
                      className={`${inputClassName} bg-black/50 border-zinc-800/80 ${activeTheme.inputFocus}`}
                    />
                  </FieldLabel>
                </div>
                <FieldLabel label="Note">
                  <input
                    value={note}
                    onChange={(event) => setNote(event.target.value)}
                    className={`${inputClassName} bg-black/50 border-zinc-800/80 ${activeTheme.inputFocus}`}
                    placeholder="e.g., Felt strong, good speed"
                  />
                </FieldLabel>
              </div>
              <div className="mt-4 rounded-xl border border-zinc-800 bg-black/35 p-3">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-zinc-500">
                    Last time
                  </p>
                  <span className="text-xs text-zinc-500">
                    {previousExerciseEntries[0]?.date || "No history"}
                  </span>
                </div>
                <div className="mt-3 grid gap-2">
                  {previousExerciseEntries.length ? (
                    previousExerciseEntries.map((entry, index) => (
                      <div
                        key={entry.id}
                        className="grid grid-cols-[56px_1fr_48px] gap-2 rounded-lg border border-zinc-850 bg-zinc-900/10 px-3 py-2 text-xs"
                      >
                        <span className="text-zinc-500">
                          Set {getSetOrder(entry, index)}
                        </span>
                        <span className="font-semibold text-zinc-200">
                          {entry.weight || "-"} kg x {entry.reps || "-"}
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            setWeight(String(entry.weight));
                            setReps(String(entry.reps));
                            setSetNumber(String(getSetOrder(entry, index)));
                          }}
                          className={`text-right text-xs font-semibold transition hover:opacity-85 ${activeTheme.text}`}
                        >
                          Use
                        </button>
                      </div>
                    ))
                  ) : (
                    <p className="text-xs text-zinc-500 italic">
                      No previous sets logged.
                    </p>
                  )}
                </div>
              </div>
              <button className={`mt-4 h-11 w-full rounded-lg px-4 text-sm font-semibold transition hover:scale-[1.01] active:scale-[0.99] duration-150 ${activeTheme.button}`}>
                Add set
              </button>
            </form>

            <section className="rounded-xl border border-zinc-800/60 bg-zinc-900/10 backdrop-blur-md p-4">
              <h2 className="text-base font-semibold text-white">Rest day</h2>
              <div className="mt-4 grid gap-3.5">
                <FieldLabel label="Date">
                  <input
                    type="date"
                    value={date}
                    onChange={(event) => setDate(event.target.value)}
                    className={`${inputClassName} bg-black/50 border-zinc-800/80 ${activeTheme.inputFocus}`}
                  />
                </FieldLabel>
                <FieldLabel label="Note">
                  <input
                    value={restNote}
                    onChange={(event) => setRestNote(event.target.value)}
                    className={`${inputClassName} bg-black/50 border-zinc-800/80 ${activeTheme.inputFocus}`}
                    placeholder="Sleep, soreness, travel, etc."
                  />
                </FieldLabel>
              </div>
              <button
                type="button"
                onClick={() => void addRestDay()}
                className={`mt-4 h-11 w-full rounded-lg border px-4 text-sm font-semibold transition hover:scale-[1.01] active:scale-[0.99] duration-150 ${activeTheme.outlineButton}`}
              >
                Mark rest day
              </button>
            </section>

            {/* Paste notes section removed */}

            <section className="rounded-xl border border-zinc-900 bg-zinc-950/20 p-4">
              <h2 className="text-base font-semibold text-white">Exercise list</h2>
              <div className="mt-4 grid gap-3">
                {bodyParts.map((part) => (
                  <div
                    key={part}
                    className="rounded-lg border border-zinc-900 bg-black p-3"
                  >
                    <p className="text-xs font-semibold uppercase tracking-[0.14em] text-zinc-500">
                      {part}
                    </p>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {(fullExerciseCatalog[part] || []).map(
                        (catalogExercise) => (
                          <button
                            key={catalogExercise}
                            type="button"
                            onClick={() => {
                              setBodyPart(part);
                              setExercise(catalogExercise);
                            }}
                            className="rounded-lg border border-zinc-900 bg-zinc-950/30 px-2.5 py-1.5 text-left text-xs font-medium text-zinc-300 transition hover:border-zinc-700 hover:text-white"
                          >
                            {catalogExercise}
                          </button>
                        ),
                      )}
                    </div>
                    {/* Add Custom Exercise Form */}
                    <form
                      onSubmit={(e) => {
                        e.preventDefault();
                        const form = e.currentTarget;
                        const input = form.elements.namedItem("newExercise") as HTMLInputElement;
                        const name = input.value.trim();
                        if (name) {
                          addCustomExercise(part, name);
                          input.value = "";
                        }
                      }}
                      className="mt-3 flex gap-1.5"
                    >
                      <input
                        name="newExercise"
                        className="h-7 min-w-0 flex-1 rounded bg-black px-2 text-[11px] text-zinc-300 border border-zinc-900 focus:border-zinc-800 outline-none placeholder:text-zinc-800"
                        placeholder="Add custom exercise..."
                      />
                      <button className="h-7 rounded bg-zinc-950 border border-zinc-900 px-2.5 text-[11px] font-semibold text-zinc-400 hover:text-white hover:border-zinc-700 transition">
                        +
                      </button>
                    </form>
                  </div>
                ))}
              </div>
            </section>
          </section>

          {/* Right Column: History & Analytics */}
          <section className="space-y-6">
            {/* Analytics Components (Compare, Progress Grid, Set Breakdown) */}
            <div className={`space-y-6 lg:block ${mobileTab === "analytics" ? "block" : "hidden"}`}>
              <div className="rounded-xl border border-zinc-800/60 bg-zinc-900/10 backdrop-blur-md p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <h2 className="text-base font-semibold text-white">Compare</h2>
                  <select
                    value={compareProfile.id}
                    onChange={(event) => setCompareProfileId(event.target.value)}
                    className={`${selectClassName} bg-black/50 border-zinc-800/80 focus:border-zinc-500`}
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

                <div className="mt-4 grid grid-cols-3 gap-2">
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

                <div className="mt-4 overflow-hidden rounded-xl border border-zinc-800/60">
                  <div className="grid grid-cols-[1fr_80px_80px_70px] gap-2 border-b border-zinc-850 bg-black/60 px-3.5 py-3 text-[10px] sm:text-xs font-semibold uppercase tracking-[0.14em] text-zinc-500 sm:grid-cols-[1fr_110px_110px_120px]">
                    <span>Exercise</span>
                    <span>{activeProfile.name}</span>
                    <span>{compareProfile.name}</span>
                    <span>Lead</span>
                  </div>
                  {comparisonRows.map((row) => (
                    <div
                      key={row.name}
                      className="grid grid-cols-[1fr_80px_80px_70px] gap-2 border-b border-zinc-850 bg-zinc-900/5 px-3.5 py-3 text-xs sm:text-sm last:border-b-0 sm:grid-cols-[1fr_110px_110px_120px]"
                    >
                      <span className="font-semibold text-white truncate">{row.name}</span>
                      <span className="text-zinc-300 font-medium">{row.leftBest}</span>
                      <span className="text-zinc-300 font-medium">{row.rightBest}</span>
                      <span className="text-zinc-500 truncate">{row.leader}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {progress.map((item) => (
                  <article
                    key={item.name}
                    className="rounded-xl border border-zinc-800/60 bg-zinc-900/10 backdrop-blur-md p-4"
                  >
                    <h3 className="text-sm font-semibold text-white truncate">{item.name}</h3>
                    <dl className="mt-4 grid grid-cols-3 gap-2 text-xs text-zinc-400">
                      <Stat label="Best" value={item.bestLabel} />
                      <Stat label="Est. max" value={String(item.oneRepMax)} />
                      <Stat label="Sets" value={String(item.totalSets)} />
                    </dl>
                  </article>
                ))}
              </div>

              <div className="rounded-xl border border-zinc-800/60 bg-zinc-900/10 backdrop-blur-md p-4">
                <h2 className="text-base font-semibold text-white">Set breakdown</h2>
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  {setBreakdowns.map((item) => (
                    <article
                      key={item.name}
                      className="rounded-xl border border-zinc-850 bg-black/45 p-3.5"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <h3 className="text-xs sm:text-sm font-semibold text-white truncate">{item.name}</h3>
                        <span className="rounded-md border border-zinc-800 px-2 py-0.5 text-[10px] font-semibold text-zinc-400">
                          {item.bodyPart}
                        </span>
                      </div>
                      <div className="mt-3 grid gap-2">
                        {item.sets.map((entry, index) => (
                          <div
                            key={entry.id}
                            className="grid grid-cols-[52px_1fr_56px] gap-2 rounded-lg border border-zinc-850 bg-zinc-900/10 px-3 py-2 text-xs"
                          >
                            <span className="text-zinc-500">Set {getSetOrder(entry, index)}</span>
                            <span className="font-semibold text-zinc-200">
                              {entry.weight || "-"} x {entry.reps || "-"}
                            </span>
                            <span className="text-right text-zinc-500 font-medium">
                              {entry.date.slice(5)}
                            </span>
                          </div>
                        ))}
                      </div>
                    </article>
                  ))}
                </div>
              </div>
            </div>
                       {/* Collapsible History Logs Grouped by Date */}
            <div className={`space-y-4 lg:block ${mobileTab === "history" ? "block" : "hidden"}`}>
              <div className="flex flex-col gap-3 rounded-xl border border-zinc-900 bg-zinc-950/20 p-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-3 justify-between sm:justify-start w-full sm:w-auto">
                  <h2 className="text-base font-semibold text-white">
                    {activeProfile.name} log
                  </h2>
                  <button
                    type="button"
                    onClick={copyAISummary}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition ${
                      copySuccess
                        ? "bg-emerald-950/20 border-emerald-800/40 text-emerald-400"
                        : "bg-zinc-900/30 border-zinc-800/80 text-zinc-300 hover:border-zinc-650 hover:bg-zinc-900/60"
                    }`}
                  >
                    {copySuccess ? (
                      <>
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                        Copied!
                      </>
                    ) : (
                      <>
                        <svg className={`w-3.5 h-3.5 ${activeTheme.text}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
                        </svg>
                        Copy for AI Summary
                      </>
                    )}
                  </button>
                </div>
                <select
                  value={selectedExercise}
                  onChange={(event) => setSelectedExercise(event.target.value)}
                  className={`${selectClassName} bg-black border-zinc-900 focus:border-zinc-550`}
                >
                  <option>All</option>
                  {exercises.map((name) => (
                    <option key={name}>{name}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-3">
                {groupedEntriesByDate.length === 0 ? (
                  <div className="text-center py-8 rounded-xl border border-dashed border-zinc-900 bg-zinc-950/20">
                    <p className="text-sm text-zinc-500">No entries logged yet.</p>
                  </div>
                ) : (
                  groupedEntriesByDate.map((day) => {
                    const isExpanded = expandedDates[day.date] !== false;
                    const dayLabel = day.isRest
                      ? "Rest Day"
                      : `${day.bodyParts.join(" & ")} Day`;

                    return (
                      <div key={day.date} className="rounded-xl border border-zinc-900 bg-zinc-950/10 overflow-hidden transition hover:border-zinc-800">
                        {/* Day Header Row */}
                        <button
                          type="button"
                          onClick={() => toggleDateExpanded(day.date)}
                          className="w-full flex items-center justify-between gap-4 px-4 py-3.5 bg-zinc-950/40 border-b border-zinc-900 text-left transition hover:bg-zinc-950/60"
                        >
                          <div className="flex items-center gap-3">
                            <span className="text-sm font-semibold text-white">{day.date}</span>
                            <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold tracking-wide uppercase border ${
                              day.isRest
                                ? "bg-amber-950/20 text-amber-400 border-amber-800/30"
                                : "bg-violet-950/20 text-violet-400 border-violet-800/30"
                            }`}>
                              {dayLabel}
                            </span>
                          </div>
                          <div className="flex items-center gap-3">
                            <span className="text-xs text-zinc-500 font-medium">
                              {day.entries.length} {day.entries.length === 1 ? "set" : "sets"}
                            </span>
                            <span className="text-xs text-zinc-400 font-semibold select-none">
                              {isExpanded ? "▲" : "▼"}
                            </span>
                          </div>
                        </button>

                        {/* Day Content (Expanded exercise entries list) */}
                        {isExpanded && (
                          <div className="p-3 md:p-4 space-y-3 bg-black/40">
                            
                            {/* Mobile View: Exercise Cards inside Expanded Day */}
                            <div className="block md:hidden space-y-3">
                              {day.groupedItems.map((item, itemIdx) => {
                                if (item.kind === "rest" || item.kind === "single") {
                                  const entry = item.entry;
                                  const entryTheme = getProfileTheme(entry.profileId, profiles);
                                  return (
                                    <div key={entry.id}>
                                      {editingEntry?.id === entry.id ? (
                                        <article className="rounded-xl border border-white/80 bg-zinc-950 p-4 shadow-lg space-y-3">
                                          <div className="grid grid-cols-2 gap-2">
                                            <FieldLabel label="Date">
                                              <input
                                                type="date"
                                                value={editingEntry.date}
                                                onChange={(event) =>
                                                  updateEditingEntry("date", event.target.value)
                                                }
                                                className={compactInputClassName}
                                              />
                                            </FieldLabel>
                                            <FieldLabel label="Person">
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
                                            </FieldLabel>
                                          </div>

                                          <div className="grid grid-cols-2 gap-2">
                                            <FieldLabel label="Body part">
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
                                            </FieldLabel>
                                            <FieldLabel label="Exercise">
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
                                                  {(fullExerciseCatalog[editingEntry.bodyPart] || []).map((catalogExercise) => (
                                                    <option key={catalogExercise}>{catalogExercise}</option>
                                                  ))}
                                                </select>
                                              )}
                                            </FieldLabel>
                                          </div>

                                          {editingEntry.kind !== "rest" && editingEntry.bodyPart !== "Rest" && (
                                            <div className="grid grid-cols-2 gap-2">
                                              <FieldLabel label="Weight">
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
                                              </FieldLabel>
                                              <FieldLabel label="Reps">
                                                <input
                                                  type="number"
                                                  min="0"
                                                  value={editingEntry.reps}
                                                  onChange={(event) =>
                                                    updateEditingEntry("reps", event.target.value)
                                                  }
                                                  className={compactInputClassName}
                                                />
                                              </FieldLabel>
                                            </div>
                                          )}

                                          <FieldLabel label="Note">
                                            <input
                                              value={editingEntry.note}
                                              onChange={(event) =>
                                                updateEditingEntry("note", event.target.value)
                                              }
                                              className={compactInputClassName}
                                              placeholder="Note"
                                            />
                                          </FieldLabel>

                                          <div className="flex gap-2 pt-2 border-t border-zinc-900">
                                            <button
                                              type="button"
                                              onClick={() => void saveEditingEntry()}
                                              className="h-9 flex-1 rounded-lg bg-white px-3 text-xs font-semibold text-black transition hover:bg-zinc-200"
                                            >
                                              Save
                                            </button>
                                            <button
                                              type="button"
                                              onClick={() => setEditingEntry(null)}
                                              className="h-9 flex-1 rounded-lg border border-zinc-800 px-3 text-xs font-semibold text-zinc-400 transition hover:border-zinc-500"
                                            >
                                              Cancel
                                            </button>
                                          </div>
                                        </article>
                                      ) : (
                                        <article className={`relative overflow-hidden rounded-xl border border-zinc-900 bg-zinc-950/40 p-3.5 shadow-sm hover:border-zinc-800 transition ${entryTheme.borderLeft}`}>
                                          <div className="flex items-start justify-between gap-3">
                                            <div>
                                              <h4 className="font-semibold text-white text-[15px] leading-snug flex items-center gap-2">
                                                {entry.exercise}
                                                {entry.createdAt && (
                                                  <span className="text-[10px] text-zinc-500 font-normal">
                                                    {formatEntryTime(entry.createdAt)}
                                                  </span>
                                                )}
                                              </h4>
                                            </div>
                                            {entry.kind !== "rest" && (
                                              <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase ${entryTheme.badge}`}>
                                                {entry.bodyPart}
                                              </span>
                                            )}
                                          </div>

                                          <div className="mt-3 flex items-center justify-between gap-4 border-t border-zinc-900 pt-2.5">
                                            <div className="flex items-center gap-5">
                                              <div>
                                                <p className="text-[9px] uppercase tracking-wider text-zinc-650 font-bold">Logged By</p>
                                                <span className={`mt-0.5 inline-flex items-center text-xs font-semibold ${entryTheme.text}`}>
                                                  <svg className="w-3.5 h-3.5 mr-1 text-zinc-550" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                                                    <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                                                  </svg>
                                                  {profiles.find((profile) => profile.id === entry.profileId)?.name || "Unknown"}
                                                </span>
                                              </div>
                                              {entry.kind !== "rest" && (
                                                <>
                                                  <div>
                                                    <p className="text-[9px] uppercase tracking-wider text-zinc-650 font-bold">Weight</p>
                                                    <p className="mt-0.5 text-xs font-bold text-white">{entry.weight ? `${entry.weight} kg` : "-"}</p>
                                                  </div>
                                                  <div>
                                                    <p className="text-[9px] uppercase tracking-wider text-zinc-650 font-bold">Reps</p>
                                                    <p className="mt-0.5 text-xs font-bold text-white">{entry.reps || "-"}</p>
                                                  </div>
                                                </>
                                              )}
                                            </div>

                                            <div className="flex gap-1.5">
                                              <button
                                                type="button"
                                                onClick={() => startEditingEntry(entry)}
                                                className="h-8 rounded-lg border border-zinc-900 bg-black px-3 text-xs font-semibold text-zinc-300 transition hover:border-zinc-700 hover:text-white"
                                              >
                                                Edit
                                              </button>
                                              <button
                                                type="button"
                                                onClick={() => void deleteEntry(entry)}
                                                className="h-8 rounded-lg border border-zinc-900 bg-black px-2.5 text-xs font-semibold text-zinc-550 transition hover:border-red-900/50 hover:text-red-400"
                                              >
                                                Del
                                              </button>
                                            </div>
                                          </div>

                                          {entry.note && (
                                            <div className="mt-2.5 rounded-lg bg-zinc-950/70 border border-zinc-900 px-3 py-2 text-xs text-zinc-450 font-medium">
                                              <span className="font-semibold text-zinc-555">Note: </span>
                                              {entry.note}
                                            </div>
                                          )}
                                        </article>
                                      )}
                                    </div>
                                  );
                                } else {
                                  // It's a dropset!
                                  const entryTheme = getProfileTheme(item.profileId, profiles);
                                  return (
                                    <div key={`${item.exercise}-${item.setNumber}`}>
                                      <article className={`relative overflow-hidden rounded-xl border border-zinc-900 bg-zinc-950/40 p-4 shadow-sm hover:border-zinc-800 transition ${entryTheme.borderLeft}`}>
                                        <div className="flex items-start justify-between gap-3">
                                          <div>
                                            <h4 className="font-semibold text-white text-[15px] leading-snug flex items-center gap-2">
                                              {item.exercise}
                                              {item.entries[0]?.createdAt && (
                                                <span className="text-[10px] text-zinc-500 font-normal">
                                                  {formatEntryTime(item.entries[0].createdAt)}
                                                </span>
                                              )}
                                            </h4>
                                            <span className={`mt-1.5 inline-flex items-center text-xs font-semibold ${entryTheme.text}`}>
                                              <svg className="w-3.5 h-3.5 mr-1 text-zinc-550" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                                                <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                                              </svg>
                                              {profiles.find((profile) => profile.id === item.profileId)?.name || "Unknown"}
                                            </span>
                                          </div>
                                          <div className="flex flex-col items-end gap-1">
                                            <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase ${entryTheme.badge}`}>
                                              {item.bodyPart}
                                            </span>
                                            <span className="inline-flex items-center px-2 py-0.5 rounded text-[9px] font-bold bg-fuchsia-950/30 text-fuchsia-400 border border-fuchsia-850/40 uppercase tracking-wider">
                                              ⚡ Drop Set (Set {item.setNumber})
                                            </span>
                                          </div>
                                        </div>

                                        <div className="mt-4 space-y-3 border-t border-zinc-900 pt-3">
                                          {item.entries.map((entry, subIdx) => (
                                            <div key={entry.id} className="rounded-lg bg-black/40 border border-zinc-900/60 p-2.5">
                                              {editingEntry?.id === entry.id ? (
                                                <div className="space-y-3">
                                                  <div className="grid grid-cols-2 gap-2">
                                                    <FieldLabel label="Date">
                                                      <input
                                                        type="date"
                                                        value={editingEntry.date}
                                                        onChange={(event) =>
                                                          updateEditingEntry("date", event.target.value)
                                                        }
                                                        className={compactInputClassName}
                                                      />
                                                    </FieldLabel>
                                                    <FieldLabel label="Person">
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
                                                    </FieldLabel>
                                                  </div>

                                                  <div className="grid grid-cols-2 gap-2">
                                                    <FieldLabel label="Weight">
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
                                                    </FieldLabel>
                                                    <FieldLabel label="Reps">
                                                      <input
                                                        type="number"
                                                        min="0"
                                                        value={editingEntry.reps}
                                                        onChange={(event) =>
                                                          updateEditingEntry("reps", event.target.value)
                                                        }
                                                        className={compactInputClassName}
                                                      />
                                                    </FieldLabel>
                                                  </div>

                                                  <FieldLabel label="Note">
                                                    <input
                                                      value={editingEntry.note}
                                                      onChange={(event) =>
                                                        updateEditingEntry("note", event.target.value)
                                                      }
                                                      className={compactInputClassName}
                                                      placeholder="Note"
                                                    />
                                                  </FieldLabel>

                                                  <div className="flex gap-2 pt-2 border-t border-zinc-900">
                                                    <button
                                                      type="button"
                                                      onClick={() => void saveEditingEntry()}
                                                      className="h-9 flex-1 rounded-lg bg-white px-3 text-xs font-semibold text-black transition hover:bg-zinc-200"
                                                    >
                                                      Save
                                                    </button>
                                                    <button
                                                      type="button"
                                                      onClick={() => setEditingEntry(null)}
                                                      className="h-9 flex-1 rounded-lg border border-zinc-800 px-3 text-xs font-semibold text-zinc-400 transition hover:border-zinc-500"
                                                    >
                                                      Cancel
                                                    </button>
                                                  </div>
                                                </div>
                                              ) : (
                                                <div className="flex items-center justify-between gap-3">
                                                  <div className="flex items-center gap-4">
                                                    <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider flex items-center gap-1.5">
                                                      Sub {subIdx + 1}
                                                      {entry.createdAt && (
                                                        <span className="text-[9px] text-zinc-650 font-normal normal-case">
                                                          {formatEntryTime(entry.createdAt)}
                                                        </span>
                                                      )}
                                                    </span>
                                                    <div>
                                                      <span className="text-xs font-bold text-white">{entry.weight ? `${entry.weight} kg` : "-"}</span>
                                                      <span className="mx-1.5 text-zinc-600">x</span>
                                                      <span className="text-xs font-bold text-white">{entry.reps || "-"}</span>
                                                    </div>
                                                  </div>
                                                  <div className="flex items-center gap-1.5">
                                                    <button
                                                      type="button"
                                                      onClick={() => startEditingEntry(entry)}
                                                      className="h-7 rounded border border-zinc-900 bg-black px-2 text-[11px] font-semibold text-zinc-300 hover:border-zinc-700 hover:text-white"
                                                    >
                                                      Edit
                                                    </button>
                                                    <button
                                                      type="button"
                                                      onClick={() => void deleteEntry(entry)}
                                                      className="h-7 rounded border border-zinc-900 bg-black px-2 text-[11px] font-semibold text-zinc-555 hover:border-red-900/50 hover:text-red-400"
                                                    >
                                                      Del
                                                    </button>
                                                  </div>
                                                </div>
                                              )}
                                              {entry.note && !editingEntry && (
                                                <div className="mt-1.5 rounded bg-zinc-950/65 border border-zinc-900 px-2 py-1 text-[10px] text-zinc-400 font-medium">
                                                  Note: {entry.note}
                                                </div>
                                              )}
                                            </div>
                                          ))}
                                        </div>
                                      </article>
                                    </div>
                                  );
                                }
                              })}
                            </div>

                            {/* Desktop View: Sub-Table inside Expanded Day */}
                            <div className="hidden md:block overflow-hidden rounded-xl border border-zinc-900 bg-zinc-950/15">
                              <div className="overflow-x-auto">
                                <div className="min-w-[800px]">
                                  <div className="grid grid-cols-[110px_1fr_80px_70px_1fr_120px] gap-3 border-b border-zinc-900 bg-black/60 px-4 py-2.5 text-xs font-semibold uppercase tracking-[0.14em] text-zinc-500">
                                    <span>Person</span>
                                    <span>Exercise / Rest Log</span>
                                    <span>Weight</span>
                                    <span>Reps</span>
                                    <span>Note</span>
                                    <span>Actions</span>
                                  </div>
                                  {day.groupedItems.map((item, itemIdx) => {
                                    if (item.kind === "rest" || item.kind === "single") {
                                      const entry = item.entry;
                                      const entryTheme = getProfileTheme(entry.profileId, profiles);
                                      return (
                                        <div
                                          key={entry.id}
                                          className="grid grid-cols-[110px_1fr_80px_70px_1fr_120px] gap-3 border-b border-zinc-900 px-4 py-2.5 text-sm text-zinc-200 last:border-b-0"
                                        >
                                          {editingEntry?.id === entry.id ? (
                                            <>
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
                                                  {(fullExerciseCatalog[editingEntry.bodyPart] || []).map((catalogExercise) => (
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
                                                disabled={editingEntry.kind === "rest"}
                                              />
                                              <input
                                                type="number"
                                                min="0"
                                                value={editingEntry.reps}
                                                onChange={(event) =>
                                                  updateEditingEntry("reps", event.target.value)
                                                }
                                                className={compactInputClassName}
                                                disabled={editingEntry.kind === "rest"}
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
                                              <span className="truncate rounded-md border border-zinc-900 bg-black/40 px-2 py-0.5 text-xs font-semibold text-zinc-350 self-start flex items-center gap-1">
                                                <svg className="w-3.5 h-3.5 text-zinc-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                                                  <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                                                </svg>
                                                {profiles.find((profile) => profile.id === entry.profileId)?.name || "Unknown"}
                                              </span>
                                              <span className="font-semibold text-white truncate flex items-center gap-2">
                                                {entry.exercise}
                                                {entry.createdAt && (
                                                  <span className="text-[10px] text-zinc-550 font-normal">
                                                    {formatEntryTime(entry.createdAt)}
                                                  </span>
                                                )}
                                              </span>
                                              <span className="font-bold text-zinc-100">{entry.kind !== "rest" && entry.weight ? `${entry.weight} kg` : "-"}</span>
                                              <span className="font-bold text-zinc-150">{entry.kind !== "rest" && entry.reps ? entry.reps : "-"}</span>
                                              <span className="text-zinc-500 truncate">{entry.note || "-"}</span>
                                              <div className="flex gap-2">
                                                <button
                                                  type="button"
                                                  onClick={() => startEditingEntry(entry)}
                                                  className="h-8 flex-1 rounded-md border border-zinc-900 bg-black px-2 text-xs font-semibold text-zinc-300 transition hover:border-zinc-700 hover:text-white"
                                                >
                                                  Edit
                                                </button>
                                                <button
                                                  type="button"
                                                  onClick={() => void deleteEntry(entry)}
                                                  className="h-8 flex-1 rounded-md border border-zinc-900 bg-black px-2 text-xs font-semibold text-zinc-500 transition hover:border-red-950 hover:text-red-400"
                                                >
                                                  Del
                                                </button>
                                              </div>
                                            </>
                                          )}
                                        </div>
                                      );
                                    } else {
                                      // It's a dropset!
                                      const entryTheme = getProfileTheme(item.profileId, profiles);
                                      return (
                                        <div
                                          key={`${item.exercise}-${item.setNumber}`}
                                          className={`grid grid-cols-[110px_1fr_80px_70px_1fr_120px] gap-3 border-b border-zinc-900 px-4 py-2.5 text-sm text-zinc-200 last:border-b-0 items-start ${entryTheme.lightBg}`}
                                        >
                                          <span className={`truncate rounded-md px-2 py-0.5 text-xs font-semibold self-start flex items-center gap-1 ${entryTheme.badge}`}>
                                            <svg className="w-3.5 h-3.5 text-zinc-550" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                                              <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                                            </svg>
                                            {profiles.find((p) => p.id === item.profileId)?.name || "Unknown"}
                                          </span>
                                          <div className="flex flex-col gap-1 select-none">
                                            <span className="font-semibold text-white truncate flex items-center gap-2">
                                              {item.exercise}
                                              {item.entries[0]?.createdAt && (
                                                <span className="text-[10px] text-zinc-550 font-normal">
                                                  {formatEntryTime(item.entries[0].createdAt)}
                                                </span>
                                              )}
                                              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold bg-fuchsia-950/40 text-fuchsia-400 border border-fuchsia-800/30 uppercase tracking-wide">
                                                ⚡ Drop Set (Set {item.setNumber})
                                              </span>
                                            </span>
                                            <span className="text-[10px] text-zinc-500 font-semibold uppercase">{item.bodyPart}</span>
                                          </div>
                                          
                                          <div className="col-span-4 grid gap-2">
                                            {item.entries.map((entry, subIdx) => (
                                              <div key={entry.id} className="grid grid-cols-[80px_70px_1fr_120px] gap-3 items-center">
                                                {editingEntry?.id === entry.id ? (
                                                  <>
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
                                                    <div className="flex gap-1.5">
                                                      <button
                                                        type="button"
                                                        onClick={() => void saveEditingEntry()}
                                                        className="h-8 flex-1 rounded bg-white text-[11px] font-semibold text-black hover:bg-zinc-200"
                                                      >
                                                        Save
                                                      </button>
                                                      <button
                                                        type="button"
                                                        onClick={() => setEditingEntry(null)}
                                                        className="h-8 flex-1 rounded border border-zinc-800 text-[11px] font-semibold text-zinc-400 hover:border-zinc-555"
                                                      >
                                                        Cancel
                                                      </button>
                                                    </div>
                                                  </>
                                                ) : (
                                                  <>
                                                    <span className="font-bold text-zinc-100">{entry.weight ? `${entry.weight} kg` : "-"}</span>
                                                    <span className="font-bold text-zinc-150">{entry.reps || "-"}</span>
                                                    <span className="text-zinc-500 truncate">{entry.note || "-"}</span>
                                                    <div className="flex gap-2">
                                                      <button
                                                        type="button"
                                                        onClick={() => startEditingEntry(entry)}
                                                        className="h-8 flex-1 rounded-md border border-zinc-900 bg-black px-2 text-xs font-semibold text-zinc-300 transition hover:border-zinc-700 hover:text-white"
                                                      >
                                                        Edit
                                                      </button>
                                                      <button
                                                        type="button"
                                                        onClick={() => void deleteEntry(entry)}
                                                        className="h-8 flex-1 rounded-md border border-zinc-900 bg-black px-2 text-xs font-semibold text-zinc-550 transition hover:border-red-950 hover:text-red-400"
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
                                      );
                                    }
                                  })}
                                </div>
                              </div>
                            </div>

                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </section>
        </div>
      </section>

      {/* Premium Glassmorphic Confirmation Modal Overlay */}
      {confirmConfig && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-fade-in">
          <div className="w-full max-w-sm rounded-xl border border-zinc-800 bg-zinc-950/95 p-5 shadow-2xl shadow-black/80">
            <h3 className="text-base font-semibold text-white">{confirmConfig.title}</h3>
            <p className="mt-2 text-xs text-zinc-450">{confirmConfig.message}</p>
            <div className="mt-5 flex gap-3">
              <button
                type="button"
                onClick={() => setConfirmConfig(null)}
                className="h-9 flex-1 rounded-lg border border-zinc-800 bg-black/40 px-3 text-xs font-semibold text-zinc-450 hover:border-zinc-650 hover:text-white transition"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  confirmConfig.onConfirm();
                  setConfirmConfig(null);
                }}
                className={`h-9 flex-1 rounded-lg px-3 text-xs font-semibold transition ${
                  confirmConfig.isDanger
                    ? "bg-red-950/20 text-red-400 border border-red-800/40 hover:bg-red-900/40 hover:text-red-300"
                    : "bg-white text-black hover:bg-zinc-200"
                }`}
              >
                {confirmConfig.confirmText || "Confirm"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Premium Sleek Custom Slide-Up Toast Notification */}
      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 rounded-full border border-zinc-850 bg-zinc-950/95 backdrop-blur-md px-4 py-2.5 text-[11px] font-semibold text-zinc-200 shadow-2xl shadow-black/80 border-t-zinc-800/40 animate-slide-up">
          <span className={`inline-flex h-2 w-2 rounded-full ${
            toast.type === "error"
              ? "bg-red-400 shadow-[0_0_8px_rgba(248,113,113,0.7)]"
              : activeTheme.dot
          }`} />
          {toast.message}
        </div>
      )}

      {/* Inline styles for custom premium transitions and scroll bar adjustments */}
      <style>{`
        .scrollbar-none::-webkit-scrollbar {
          display: none;
        }
        .scrollbar-none {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
        @keyframes slideUp {
          from { transform: translate(-50%, 20px); opacity: 0; }
          to { transform: translate(-50%, 0); opacity: 1; }
        }
        .animate-slide-up {
          animation: slideUp 0.25s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        .animate-fade-in {
          animation: fadeIn 0.15s ease-out forwards;
        }
      `}</style>
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

function Metric({ label, value, valueClassName }: { label: string; value: string; valueClassName?: string }) {
  return (
    <div className="min-w-0 flex-1 rounded-md border border-zinc-900 bg-zinc-950 px-2.5 py-2 text-center sm:text-left">
      <p className="text-[10px] sm:text-xs font-semibold uppercase tracking-[0.14em] text-zinc-500">
        {label}
      </p>
      <p className={`mt-1 truncate text-lg sm:text-2xl font-semibold ${valueClassName || "text-white"}`}>{value}</p>
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
