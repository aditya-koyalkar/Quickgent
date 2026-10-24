import {
  createContext,
  useContext,
  useCallback,
  type ReactNode,
} from 'react';
import { useMe, useSignIn, useSignUp, useLogout } from '../hooks/useAuth';
import type { AuthUser } from '../lib/api';

interface AuthContextType {
  user: AuthUser | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  signIn: (emailOrUsername: string, password: string) => Promise<void>;
  signUp: (username: string, email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const meQuery = useMe();
  const signInMutation = useSignIn();
  const signUpMutation = useSignUp();
  const logoutMutation = useLogout();

  const user = meQuery.data ?? null;
  const isLoading = meQuery.isLoading;
  const isAuthenticated = !!user;

  const signIn = useCallback(
    async (emailOrUsername: string, password: string) => {
      await signInMutation.mutateAsync({ emailOrUsername, password });
    },
    [signInMutation],
  );

  const signUp = useCallback(
    async (username: string, email: string, password: string) => {
      await signUpMutation.mutateAsync({ username, email, password });
    },
    [signUpMutation],
  );

  const signOut = useCallback(async () => {
    await logoutMutation.mutateAsync();
  }, [logoutMutation]);

  return (
    <AuthContext.Provider
      value={{ user, isLoading, isAuthenticated, signIn, signUp, signOut }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (ctx === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return ctx;
}
