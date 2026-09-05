import React, { useState } from 'react';
import { useRouter } from 'next/router';

export const USERNAME_MIN = 3;
export const USERNAME_MAX = 30;
export const PASSWORD_MIN = 8;

/** The client-side check; the server applies the same rules. */
export const validateLoginForm = (username: string, password: string): string | null => {
  if (!username || !password) return 'Username and password are required';
  if (username.length < USERNAME_MIN || username.length > USERNAME_MAX) {
    return `Username must be between ${USERNAME_MIN} and ${USERNAME_MAX} characters`;
  }
  if (password.length < PASSWORD_MIN) return `Password must be at least ${PASSWORD_MIN} characters`;
  return null;
};

const Login: React.FC = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    // The old version set the error and submitted anyway.
    const problem = validateLoginForm(username, password);
    if (problem) {
      setError(problem);
      return;
    }

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-type': 'application/json' },
        body: JSON.stringify({ username, password })
      });
      const data = await response.json();

      if (response.status === 429) {
        setError('Too many requests. Please try again later.');
        return;
      }
      if (!response.ok) {
        setError(data.error || 'An error occurred. Please try again.');
        return;
      }
      if (data.token && typeof window !== 'undefined') {
        window.localStorage.setItem('token', data.token);
        router.push('/');
      }
    } catch {
      setError('An unexpected error occurred. Please try again.');
    }
  };

  return (
    <div className="max-w-md w-full h-160px p-10 space-y-8 ">
      <div>
        <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
          Sign in to Your Account
        </h2>
      </div>
      <form className="space-y-6 w-full bg-gray-200 p-8" onSubmit={handleSubmit}>
        <div className="rounded-md shadow-sm space-y-4 py-2 ">
          <div>
            <label htmlFor="username" className="sr-only">
              Username
            </label>
            <input
              id="username"
              name="username"
              type="text"
              required
              autoComplete="username"
              className="appearance-none rounded-none relative block w-full px-3 py-3 border border-gray-300 placeholder-gray-500 text-gray-900 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 focus:z-10 sm:text-sm"
              placeholder="Username"
              value={username}
              onChange={e => setUsername(e.target.value)}
            />
          </div>
          <div>
            <label htmlFor="password" className="sr-only">
              Password
            </label>
            <input
              id="password"
              name="password"
              type="password"
              required
              autoComplete="current-password"
              className="appearance-none rounded-none relative block w-full px-3 py-3 border border-gray-300 placeholder-gray-500 text-gray-900  focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 focus:z-10 sm:text-sm"
              placeholder="Password"
              value={password}
              onChange={e => setPassword(e.target.value)}
            />
          </div>
        </div>
        {error && (
          <div role="alert" className="text-red-500 text-sm">
            {error}
          </div>
        )}

        <button
          type="submit"
          className="group relative w-full flex justify-center py-3 px-3 border border-transparent text-sm font-medium rounded-md text-white bg-gray-600 hover:bg-stone-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-stone-500"
        >
          Sign in
        </button>
      </form>
    </div>
  );
};
export default Login;
