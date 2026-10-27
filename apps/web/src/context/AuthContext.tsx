import {
  createContext,
  useContext,
  useCallback,
  useState,
  useEffect,
  type ReactNode,
} from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useMe, authKeys } from '../hooks/useAuth';
import { authApi, type AuthUser } from '../lib/api';

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
  const queryClient = useQueryClient();
  const meQuery = useMe();
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null);

  // Synchronize currentUser with meQuery
  useEffect(() => {
    if (meQuery.data) {
      setCurrentUser(meQuery.data);
    } else if (meQuery.isError) {
      setCurrentUser(null);
    }
  }, [meQuery.data, meQuery.isError]);

  const user = currentUser ?? meQuery.data ?? null;
  const isLoading = meQuery.isLoading && !currentUser;
  const isAuthenticated = !!user;

  const signIn = useCallback(
    async (emailOrUsername: string, password: string) => {
      const response = await authApi.signIn({ emailOrUsername, password });
      setCurrentUser(response.user);
      queryClient.setQueryData(authKeys.me(), response.user);
    },
    [queryClient],
  );

  const signUp = useCallback(
    async (username: string, email: string, password: string) => {
      const response = await authApi.signUp({ username, email, password });
      setCurrentUser(response.user);
      queryClient.setQueryData(authKeys.me(), response.user);
    },
    [queryClient],
  );

  const signOut = useCallback(async () => {
    try {
      await authApi.logout();
    } finally {
      setCurrentUser(null);
      queryClient.setQueryData(authKeys.me(), null);
      queryClient.invalidateQueries({ queryKey: authKeys.all });
    }
  }, [queryClient]);

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
