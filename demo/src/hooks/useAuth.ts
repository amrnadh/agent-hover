import { useState } from 'react';

export interface User {
  name: string;
  email?: string;
  role?: string;
}

export interface AuthState {
  user: User | null;
  isLoading: boolean;
}

/**
 * Authentication hook returning current mock user session state.
 */
export function useAuth(): AuthState {
  const [user] = useState<User | null>({
    name: 'Alex Johnson',
    email: 'alex.johnson@example.com',
    role: 'Lead Architect',
  });
  const [isLoading] = useState<boolean>(false);

  return { user, isLoading };
}

export default useAuth;
