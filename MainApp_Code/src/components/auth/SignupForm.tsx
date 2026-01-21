'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { signUp } from '@/lib/actions/auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Loader2 } from 'lucide-react';
import Link from 'next/link';

interface SignupFormProps {
  onSuccess?: () => void;
}

export function SignupForm({ onSuccess }: SignupFormProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [acceptedTerms, setAcceptedTerms] = useState(false);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const formData = new FormData(e.currentTarget);
      const result = await signUp(formData);
      if (result?.error) {
        setError(result.error);
      } else if (result?.success) {
        // Redirect to login page after successful signup
        router.push('/login');
        onSuccess?.();
      }
    } catch (err) {
      setError('An unexpected error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignUp = async () => {
    setLoading(true);
    setError('');

    try {
      const { createBrowserClient } = await import('@supabase/ssr');
      const supabase = createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      );

      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/onboarding`,
        },
      });

      if (error) {
        setError(error.message);
      }
    } catch (err) {
      setError('An unexpected error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="bg-destructive/10 border border-destructive/20 text-destructive px-4 py-3  text-sm">
            {error}
          </div>
        )}

        <div className="space-y-2">
          <Label htmlFor="name">Full name</Label>
          <Input
            id="name"
            name="name"
            type="text"
            placeholder="Enter your full name"
            required
            disabled={loading}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="email">Email address</Label>
          <Input
            id="email"
            name="email"
            type="email"
            placeholder="Enter your email"
            required
            disabled={loading}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="password">Password</Label>
          <Input
            id="password"
            name="password"
            type="password"
            placeholder="Create a password"
            required
            disabled={loading}
            minLength={8}
          />
          <p className="mt-1 text-sm text-muted-foreground">
            Must be at least 8 characters long
          </p>
        </div>

        <div className="flex items-start space-x-2">
          <Checkbox 
            id="terms" 
            checked={acceptedTerms}
            onCheckedChange={(checked) => setAcceptedTerms(checked === true)}
            disabled={loading}
            required
          />
          <label 
            htmlFor="terms" 
            className="text-sm text-muted-foreground leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
          >
            I accept the{' '}
            <Link href="/legal/terms" target="_blank" className="text-white hover:underline">
              Terms of Service
            </Link>
            {' '}and{' '}
            <Link href="/legal/privacy" target="_blank" className="text-white hover:underline">
              Privacy Policy
            </Link>
          </label>
        </div>

        <Button
          type="submit"
          className="w-full bg-white text-black hover:bg-gray-200 transition-all duration-200 disabled:opacity-70 disabled:cursor-not-allowed"
          disabled={loading || !acceptedTerms}
        >
          {loading ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              <span>Creating account...</span>
            </>
          ) : (
            'Create account'
          )}
        </Button>
      </form>
    </div>
  );
}