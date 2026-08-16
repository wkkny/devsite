import { ModeToggle } from '@/components/mode-toggle'

function App() {
  return (
    <main className="min-h-svh overflow-x-clip bg-background px-2 text-foreground">
      <header className="sticky top-0 z-50 bg-background/90 backdrop-blur-sm">
        <nav className="screen-line-bottom mx-auto flex h-14 max-w-3xl items-center justify-between border-x border-line px-4">
          <a href="/" className="text-sm font-medium">
            Kritiraj
          </a>

          <ModeToggle />
        </nav>
      </header>

      <div className="mx-auto max-w-3xl">
        <div className="dot-divider h-8 border-x border-line" />

        <section className="screen-line-top screen-line-bottom min-h-[calc(100svh-5.5rem)] border-x border-line" />
      </div>
    </main>
  )
}

export default App
