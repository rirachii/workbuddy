'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import { getSupabaseClient } from '@/lib/supabase/client'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

interface AuthModalProps {
  isOpen: boolean
  onOpenChange: (open: boolean) => void
}

export function AuthModal({ isOpen, onOpenChange }: AuthModalProps) {
  const [isLoading, setIsLoading] = useState(false)
  const router = useRouter()
  const supabase = getSupabaseClient()

  const handleGoogleSignIn = async () => {
    try {
      setIsLoading(true)
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/auth/callback`
        }
      })

      if (error) throw error
    } catch (error: any) {
      toast.error(error.message || 'Error signing in with Google')
    } finally {
      setIsLoading(false)
    }
  }

  const handleAppleSignIn = async () => {
    try {
      setIsLoading(true)
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'apple',
        options: {
          redirectTo: `${window.location.origin}/auth/callback`
        }
      })

      if (error) throw error
    } catch (error: any) {
      toast.error(error.message || 'Error signing in with Apple')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Sign In</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 p-4">
          <Button 
            className="w-full" 
            onClick={handleGoogleSignIn} 
            disabled={isLoading}
          >
            {isLoading ? 'Loading...' : 'Continue with Google'}
          </Button>
          <Button 
            className="w-full" 
            onClick={handleAppleSignIn} 
            disabled={isLoading}
            variant="outline"
          >
            {isLoading ? 'Loading...' : 'Continue with Apple'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
} 