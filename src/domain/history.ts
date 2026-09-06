import { Project } from './project';

export interface HistoryCommand {
  description: string;
  execute: (project: Project) => Project;
}

export interface HistoryState {
  past: Project[];
  present: Project;
  future: Project[];
  maxHistory?: number;
}

export function createHistory(initialProject: Project, maxHistory = 50): HistoryState {
  return {
    past: [],
    present: initialProject,
    future: [],
    maxHistory,
  };
}

export function applyCommand(
  state: HistoryState,
  _description: string,
  mutate: (project: Project) => Project
): HistoryState {
  const newPresent = mutate(state.present);
  if (newPresent === state.present) {
    return state;
  }

  const max = state.maxHistory ?? 50;
  const newPast = [...state.past, state.present];
  if (newPast.length > max) {
    newPast.shift();
  }

  return {
    ...state,
    past: newPast,
    present: newPresent,
    future: [],
  };
}

export function undo(state: HistoryState): HistoryState {
  if (state.past.length === 0) return state;

  const previous = state.past[state.past.length - 1];
  const newPast = state.past.slice(0, -1);

  return {
    ...state,
    past: newPast,
    present: previous,
    future: [state.present, ...state.future],
  };
}

export function redo(state: HistoryState): HistoryState {
  if (state.future.length === 0) return state;

  const next = state.future[0];
  const newFuture = state.future.slice(1);

  return {
    ...state,
    past: [...state.past, state.present],
    present: next,
    future: newFuture,
  };
}

export function canUndo(state: HistoryState): boolean {
  return state.past.length > 0;
}

export function canRedo(state: HistoryState): boolean {
  return state.future.length > 0;
}
