import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import { saveProjectToCloud, loadProjectsFromCloud, SyncStatus } from '../services/cloudSync';
import { AppState, Project } from '../types';
import { isSupabaseConfigured } from '../services/supabase';

const DEBOUNCE_MS = 2000;

export const useCloudSync = (
  state: AppState | null,
  onProjectsLoaded: (projects: Project[]) => void
) => {
  const { user } = useAuth();
  const [syncStatus, setSyncStatus] = useState<SyncStatus>({ status: 'idle' });
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSavedSnapshotRef = useRef<string>('');
  const skipNextSaveRef = useRef<boolean>(false);
  const stateRef = useRef<AppState | null>(state);

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  const projectsSnapshot = useMemo(() => {
    if (!state?.projects) return '';
    return JSON.stringify(state.projects);
  }, [state?.projects]);

  useEffect(() => {
    if (!user || !isSupabaseConfigured()) return;

    let isMounted = true;

    const loadFromCloud = async () => {
      setSyncStatus({ status: 'saving' });
      const { projects, error } = await loadProjectsFromCloud(user.id);

      if (!isMounted) return;

      if (error) {
        setSyncStatus({ status: 'error', error });
        return;
      }

      if (projects.length > 0) {
        lastSavedSnapshotRef.current = JSON.stringify(projects);
        skipNextSaveRef.current = true;
        onProjectsLoaded(projects);
        setSyncStatus({ status: 'saved', lastSaved: new Date() });
        return;
      }

      const currentState = stateRef.current;
      if (currentState?.projects?.length) {
        for (const project of currentState.projects) {
          const { success, error: saveError } = await saveProjectToCloud(user.id, project);
          if (!success) {
            setSyncStatus({ status: 'error', error: saveError });
            return;
          }
        }
        lastSavedSnapshotRef.current = JSON.stringify(currentState.projects);
        setSyncStatus({ status: 'saved', lastSaved: new Date() });
        return;
      }

      setSyncStatus({ status: 'idle' });
    };

    loadFromCloud();

    return () => {
      isMounted = false;
    };
  }, [user?.id, onProjectsLoaded]);

  useEffect(() => {
    if (!user || !state || !isSupabaseConfigured()) return;
    if (projectsSnapshot === lastSavedSnapshotRef.current) return;

    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    setSyncStatus({ status: 'saving' });
    const snapshotToSave = projectsSnapshot;

    saveTimeoutRef.current = setTimeout(async () => {
      if (skipNextSaveRef.current) {
        skipNextSaveRef.current = false;
        lastSavedSnapshotRef.current = snapshotToSave;
        setSyncStatus({ status: 'saved', lastSaved: new Date() });
        return;
      }

      for (const project of state.projects) {
        const { success, error } = await saveProjectToCloud(user.id, project);
        if (!success) {
          setSyncStatus({ status: 'error', error });
          return;
        }
      }

      lastSavedSnapshotRef.current = snapshotToSave;
      setSyncStatus({ status: 'saved', lastSaved: new Date() });
    }, DEBOUNCE_MS);

    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, [user?.id, projectsSnapshot, state]);

  const saveAllProjects = useCallback(async () => {
    if (!user || !state || !isSupabaseConfigured()) return;

    setSyncStatus({ status: 'saving' });

    for (const project of state.projects) {
      const { success, error } = await saveProjectToCloud(user.id, project);
      if (!success) {
        setSyncStatus({ status: 'error', error });
        return;
      }
    }

    lastSavedSnapshotRef.current = JSON.stringify(state.projects);
    setSyncStatus({ status: 'saved', lastSaved: new Date() });
  }, [user?.id, state]);

  return { syncStatus, saveAllProjects };
};
