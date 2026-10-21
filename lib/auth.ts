import { useState, useEffect } from 'react';

import { supabase } from './supabase';

import type { Session, User } from '@supabase/supabase-js';

type AuthState = {
  session: Session | null;
  user: User | null;
  loading: boolean;
};

let globalSession: Session | null = null;
let globalUser: User | null = null;
let globalLoading = true;

let listeners: Set<() => void> = new Set();
let authInitialized = false;

function notify() {
  listeners.forEach((l) => l());
}

export function setAuth(session: Session | null) {
  globalSession = session;

  globalUser = session?.user ?? null;

  globalLoading = false;

  notify();
}
export function initializeAuth() {
  if (authInitialized) return;

  authInitialized = true;

  // Listen for login, logout, and session refresh events.
  supabase.auth.onAuthStateChange((_event, session) => {
    setAuth(session);
  });

  // Restore the saved session when the app starts.
  supabase.auth
    .getSession()
    .then(({ data, error }) => {
      if (error) {
        console.error('Failed to restore session:', error.message);
        setAuth(null);
        return;
      }

      setAuth(data.session);
    })
    .catch((error) => {
      console.error('Session initialization failed:', error);
      setAuth(null);
    });
}

export function useAuth(): AuthState {
  const [, forceRender] = useState(0);

  useEffect(() => {
    const listener = () => forceRender((n) => n + 1);

    listeners.add(listener);

    return () => {
      listeners.delete(listener);
    };
  }, []);

  return {
    session: globalSession,
    user: globalUser,
    loading: globalLoading,
  };
}

export type SignUpProfile = {
  full_name: string;
  role: 'student' | 'teacher';
};

export async function signUp(
  email: string,
  password: string,
  profile?: SignUpProfile
) {
  const { data, error } = await supabase.auth.signUp({ email, password });

  if (!error && data.session && profile) {
    await supabase
      .from('profiles')
      .update({ full_name: profile.full_name, role: profile.role })
      .eq('id', data.session.user.id);
  }

  if (!error && data.session) {
    setAuth(data.session);
  }

  return { data, error };
}

export async function signIn(email: string, password: string) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (!error && data.session) {
    setAuth(data.session);
  }

  return { data, error };
}

export async function signOut() {
  try {
    const { error } = await supabase.auth.signOut();

    if (error) {
      return { error: error.message };
    }

    setAuth(null);

    return { error: null };
  } catch (error: any) {
    return {
      error: error?.message ?? 'Failed to sign out.',
    };
  }
}

initializeAuth();