'use client';

import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { ArrowLeft, Moon, Sun, Volume2, Calendar, Bell, Lock, Sparkles, Mail, HelpCircle, FileText, Star, ExternalLink } from "lucide-react"
import Link from "next/link"
import { Separator } from "@/components/ui/separator"
import { useAuth } from "@/components/providers/supabase-auth-provider"
import { useTheme } from "@/components/providers/theme-provider"
import { useState } from "react"
import { AuthModal } from "@/components/auth-modal"
import { toast } from "sonner"
import { BottomNav } from "@/components/BottomNav"
import { SubscriptionPlans } from "@/components/subscription/SubscriptionPlans"
import { useSubscription } from "@/components/providers/subscription-provider"

export default function SettingsPage() {
  const { user, isLoading, signOut } = useAuth();
  const { subscriptionStatus } = useSubscription();
  const { theme, setTheme } = useTheme();
  const [showAuthModal, setShowAuthModal] = useState(false);

  const handleSignOut = async () => {
    try {
      await signOut();
      toast.success("Signed out successfully");
    } catch (error) {
      console.error("Error signing out:", error);
      toast.error("Failed to sign out");
    }
  };

  return (
    <main className="flex min-h-screen flex-col items-center p-4 pb-24 bg-background">
      <div className="w-full max-w-3xl">
        <div className="flex items-center mb-6">
          <Link href="/">
            <Button variant="ghost" size="icon" className="mr-2">
              <ArrowLeft />
            </Button>
          </Link>
          <h1 className="text-2xl font-bold">Ghosted AI Settings</h1>
        </div>

        <div className="space-y-6 mb-6">
          {user && (
            <>
              <div>
                <h2 className="text-lg font-bold mb-4">Your Subscription</h2>
                <SubscriptionPlans />
              </div>

              <Separator />
            </>
          )}

          <div>
            <h2 className="text-lg font-medium mb-4">Appearance</h2>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Sun size={18} />
                  <span>Light Mode</span>
                </div>
                <Switch 
                  id="theme-mode" 
                  checked={theme === 'dark'}
                  onCheckedChange={(checked) => setTheme(checked ? 'dark' : 'light')}
                />
                <div className="flex items-center gap-2">
                  <Moon size={18} />
                  <span>Dark Mode</span>
                </div>
              </div>
            </div>
          </div>

          <Separator />

          {user && (
            <>
              <div>
                <h2 className="text-lg font-medium mb-4">Recording</h2>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Volume2 size={18} />
                      <span>High-quality audio</span>
                    </div>
                    <Switch id="audio-quality" defaultChecked />
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Bell size={18} />
                      <span>Recording notifications</span>
                    </div>
                    <Switch id="recording-notifications" defaultChecked />
                  </div>
                </div>
              </div>

              <Separator />

              <div>
                <h2 className="text-lg font-medium mb-4">Integrations</h2>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Calendar size={18} />
                      <span>Calendar sync</span>
                      {!subscriptionStatus?.isProMember && (
                        <Sparkles className="h-4 w-4 text-yellow-500" />
                      )}
                    </div>
                    <Switch 
                      id="calendar-sync" 
                      disabled={!subscriptionStatus?.isProMember}
                    />
                  </div>
                </div>
              </div>

              <Separator />

              <div>
                <h2 className="text-lg font-medium mb-4">Privacy & Security</h2>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Lock size={18} />
                      <span>End-to-end encryption</span>
                    </div>
                    <Switch id="encryption" defaultChecked />
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Lock size={18} />
                      <span>Biometric authentication</span>
                    </div>
                    <Switch id="biometric" />
                  </div>
                </div>
              </div>

              <Separator />

              <div>
                <h2 className="text-lg font-medium mb-4">AI Features</h2>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="flex items-center gap-2">
                        Automatic transcription
                        {!subscriptionStatus?.isProMember && (
                          <Sparkles className="h-4 w-4 text-yellow-500" />
                        )}
                      </span>
                      <p className="text-sm text-muted-foreground">Convert speech to text as you record</p>
                    </div>
                    <Switch 
                      id="auto-transcription" 
                      defaultChecked={subscriptionStatus?.isProMember}
                      disabled={!subscriptionStatus?.isProMember}
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <span className="flex items-center gap-2">
                        AI summarization
                        {!subscriptionStatus?.isProMember && (
                          <Sparkles className="h-4 w-4 text-yellow-500" />
                        )}
                      </span>
                      <p className="text-sm text-muted-foreground">Generate concise summaries of your notes</p>
                    </div>
                    <Switch 
                      id="ai-summarization" 
                      defaultChecked={subscriptionStatus?.isProMember}
                      disabled={!subscriptionStatus?.isProMember}
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <span className="flex items-center gap-2">
                        Task extraction
                        {!subscriptionStatus?.isProMember && (
                          <Sparkles className="h-4 w-4 text-yellow-500" />
                        )}
                      </span>
                      <p className="text-sm text-muted-foreground">Automatically identify tasks from your notes</p>
                    </div>
                    <Switch 
                      id="task-extraction" 
                      defaultChecked={subscriptionStatus?.isProMember}
                      disabled={!subscriptionStatus?.isProMember}
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <span className="flex items-center gap-2">
                        Personalized insights
                        {!subscriptionStatus?.isProMember && (
                          <Sparkles className="h-4 w-4 text-yellow-500" />
                        )}
                      </span>
                      <p className="text-sm text-muted-foreground">Get AI-powered suggestions based on your notes</p>
                    </div>
                    <Switch 
                      id="personalized-insights" 
                      defaultChecked={subscriptionStatus?.isProMember}
                      disabled={!subscriptionStatus?.isProMember}
                    />
                  </div>
                </div>
              </div>
            </>
          )}

          <Separator />

          <div>
            <h2 className="text-lg font-medium mb-4">App Information</h2>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Mail size={18} />
                  <div>
                    <span>Contact Support</span>
                    <p className="text-sm text-muted-foreground">Get help with your account</p>
                  </div>
                </div>
                <Button variant="ghost" size="sm" asChild>
                  <Link href="mailto:michelle@veloraai.com">
                    <ExternalLink size={16} className="mr-2" />
                    Email
                  </Link>
                </Button>
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Star size={18} />
                  <div>
                    <span>Rate the App</span>
                    <p className="text-sm text-muted-foreground">Love the app? Let us know!</p>
                  </div>
                </div>
                <Button variant="ghost" size="sm" asChild>
                  <Link href="https://apps.apple.com/app/your-app-id" target="_blank">
                    <ExternalLink size={16} className="mr-2" />
                    App Store
                  </Link>
                </Button>
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <FileText size={18} />
                  <div>
                    <span>Terms & Privacy</span>
                    <p className="text-sm text-muted-foreground">Read our policies</p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button variant="ghost" size="sm" asChild>
                    <Link href="/terms">Terms</Link>
                  </Button>
                  <Button variant="ghost" size="sm" asChild>
                    <Link href="/privacy">Privacy</Link>
                  </Button>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <HelpCircle size={18} />
                  <div>
                    <span>Help Center</span>
                    <p className="text-sm text-muted-foreground">Browse FAQs and guides</p>
                  </div>
                </div>
                <Button variant="ghost" size="sm" asChild>
                  <Link href="/help" target="_blank">
                    <ExternalLink size={16} className="mr-2" />
                    Visit
                  </Link>
                </Button>
              </div>

              <div className="text-sm text-muted-foreground text-center mt-6">
                <p>Version 1.0.0</p>
                <p>© 2024 Ghosted AI. All rights reserved.</p>
              </div>
            </div>
          </div>

          <div className="pt-4">
            {isLoading ? (
              <Button variant="outline" className="w-full" disabled>
                Loading...
              </Button>
            ) : user ? (
              <Button variant="outline" className="w-full" onClick={handleSignOut}>
                Sign Out
              </Button>
            ) : (
              <Button variant="default" className="w-full" onClick={() => setShowAuthModal(true)}>
                Sign In
              </Button>
            )}
          </div>
        </div>

        <AuthModal 
          isOpen={showAuthModal} 
          onOpenChange={setShowAuthModal}
        />
        <BottomNav />
      </div>
    </main>
  );
}

