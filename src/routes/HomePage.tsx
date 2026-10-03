import { useLayoutEffect, useRef, useState } from 'react'
import { Link, useNavigate } from '@tanstack/react-router'
import { BadgeCheck, Flame, Heart, MessageCircle, Share2 } from 'lucide-react'
import { LoginForm } from '@/components/auth/LoginForm'
import { BrandLogo } from '@/components/brand/Brand'
import { RegisterForm } from '@/components/auth/RegisterForm'

function VibePostPreview() {
  return (
    <div className="relative mx-auto w-full max-w-[400px] pt-10 pb-12 lg:mx-0">
      <article className="relative rounded-3xl border border-border bg-card p-4 shadow-[0_24px_60px_-28px_rgb(29_42_122/0.35)]">
        <header className="flex items-center gap-3">
          <div className="grid size-11 place-items-center rounded-full bg-gradient-to-br from-brand-navy to-brand-blue text-sm font-bold text-white">
            AV
          </div>
          <div className="min-w-0">
            <p className="flex items-center gap-1 text-sm font-bold text-ink">
              Aria Vance
              <BadgeCheck className="size-4 fill-brand-blue text-white" />
            </p>
            <p className="text-xs text-muted-foreground">Shared a vibe · 2m ago</p>
          </div>
          <span className="ml-1 self-start rounded-full bg-sky-100 px-2.5 py-0.5 text-[11px] font-semibold text-sky-700">
            Community
          </span>
        </header>

        <div className="vibe-gradient mt-4 grid h-[clamp(7.5rem,28vh,17.5rem)] place-items-center rounded-2xl px-6 text-center">
          <p className="text-base font-bold text-white drop-shadow-sm sm:text-lg">
            ✌️ Spread Peace &amp; Good Energy Today!
          </p>
        </div>

        <footer className="mt-3 flex items-center justify-between px-1 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1.5">
            <Heart className="size-4 fill-rose-500 text-rose-500" />
            1.4k Likes
          </span>
          <span className="inline-flex items-center gap-1.5">
            <MessageCircle className="size-4" />
            384 Comments
          </span>
          <span className="inline-flex items-center gap-1.5">
            <Share2 className="size-4" />
            Share
          </span>
        </footer>
      </article>

      <div className="landing-float absolute top-0 -right-2 flex items-center gap-3 rounded-2xl border border-border bg-card px-3.5 py-2.5 shadow-lg sm:-right-10">
        <div className="grid size-9 place-items-center rounded-xl bg-amber-400 text-lg">✌️</div>
        <div>
          <p className="text-xs font-bold text-ink">Peace Hub</p>
          <p className="text-[11px] text-muted-foreground">12.5k Members online</p>
        </div>
      </div>

      <div className="landing-float-delay absolute bottom-0 -left-2 flex items-center gap-3 rounded-2xl border border-border bg-card px-3.5 py-2.5 shadow-lg sm:-left-6">
        <div className="brand-gradient grid size-9 place-items-center rounded-xl text-white">
          <Flame className="size-4" />
        </div>
        <div>
          <p className="text-xs font-bold text-ink">Trending Vibe</p>
          <p className="text-[11px] text-muted-foreground">Global Hangout Lounge</p>
        </div>
      </div>
    </div>
  )
}

function AuthPanel() {
  const navigate = useNavigate()
  const [mode, setMode] = useState<'login' | 'register'>('login')
  const panelRef = useRef<HTMLElement>(null)

  useLayoutEffect(() => {
    panelRef.current?.scrollTo({ top: 0 })
  }, [mode])

  const onAuthenticated = () => {
    void navigate({ to: '/feed' })
  }

  return (
    <aside
      ref={panelRef}
      className="status-rise-delay relative flex flex-col items-center px-6 pb-8 lg:w-[42%] lg:max-w-[720px] lg:overflow-y-auto lg:border-l lg:border-border lg:bg-white lg:px-12 lg:pb-0"
    >
      <div key={mode} className="status-rise my-auto flex w-full justify-center">
        {mode === 'login' ? (
          <LoginForm onCreateAccount={() => setMode('register')} onAuthenticated={onAuthenticated} />
        ) : (
          <RegisterForm onBack={() => setMode('login')} onAuthenticated={onAuthenticated} />
        )}
      </div>
    </aside>
  )
}

export default function HomePage() {
  return (
    <div className="relative flex min-h-dvh flex-col overflow-hidden bg-background lg:h-dvh">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          backgroundImage:
            'radial-gradient(ellipse 45% 40% at 8% 0%, rgb(90 174 232 / 0.14), transparent 70%), radial-gradient(ellipse 40% 45% at 92% 30%, rgb(42 107 214 / 0.10), transparent 70%), radial-gradient(ellipse 50% 40% at 40% 100%, rgb(30 58 138 / 0.08), transparent 70%)',
        }}
      />

      <div className="relative flex min-h-0 flex-1 flex-col lg:flex-row">
        <main className="flex min-h-0 flex-1 items-center justify-center px-6 py-6 lg:px-12 lg:py-[clamp(1rem,4vh,4rem)]">
          <div className="w-full max-w-[600px]">
            <section className="status-rise">
              <BrandLogo className="gap-2 text-[2.5rem] lg:text-[clamp(2.25rem,5.5vh,3.25rem)]" />
              <h1 className="mt-4 max-w-[36rem] text-[2rem] leading-[1.05] font-medium tracking-[-0.015em] text-ink sm:text-5xl lg:mt-[clamp(0.75rem,2.5vh,1.5rem)] lg:text-[clamp(2rem,5.2vh,3.75rem)]">
                Connect with your community and <span className="brand-gradient-text">peacemakers worldwide</span> on
                denuwe.
              </h1>
            </section>

            <section className="status-rise-delay-2 mt-[clamp(0.5rem,2vh,2rem)] hidden lg:block">
              <VibePostPreview />
            </section>
          </div>
        </main>

        <AuthPanel />
      </div>

      <footer className="relative border-t border-border/70 bg-white/60 backdrop-blur">
        <div className="flex items-center justify-between gap-3 px-6 py-3 text-xs text-muted-foreground lg:px-12">
          <nav className="flex gap-x-5">
            <span className="hidden sm:inline">About</span>
            <span className="hidden sm:inline">Communities</span>
            <span className="hidden sm:inline">Pages</span>
            <span className="hidden sm:inline">Privacy</span>
            <span className="hidden sm:inline">Terms</span>
            <Link to="/status" className="hover:text-ink hover:underline">
              System status
            </Link>
          </nav>
          <p>© {new Date().getFullYear()} denuwe</p>
        </div>
      </footer>
    </div>
  )
}
