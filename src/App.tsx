import { useMemo, useState, useSyncExternalStore } from 'react'
import { flushSync } from 'react-dom'
import { Dithering } from '@paper-design/shaders-react'
import { motion, useReducedMotion } from 'motion/react'
import { FiArrowUpRight, FiGithub, FiGrid, FiList, FiMail, FiMapPin } from 'react-icons/fi'
import { FaXTwitter } from 'react-icons/fa6'

import profilePicture from '@/assets/profile-picture.png'
import { DraggableDecorations } from '@/components/draggable-decorations'
import { GitHubActivity } from '@/components/github-activity'
import { ProjectStatus } from '@/components/project-status'
import { SpotifyStatus } from '@/components/spotify-status'
import { Tooltip } from '@/components/motion/tooltip'
import { useTheme } from '@/components/theme-context'
import { ThemeToggle } from '@/components/theme-toggle'
import { ViewerCounter } from '@/components/viewer-counter'
import { ThemeDotCursor } from '@/components/theme-dot-cursor'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { EASE_OUT } from '@/lib/ease'

const projects = [
  {
    name: 'WorkBench',
    mark: 'WB',
    description:
      'A local-first AI workbench for confidential industrial documents. The repo has a Windows desktop UI and an Ollama adapter. Its inspection workflow is still in progress.',
    stack: ['Electron', 'React', 'TypeScript', 'FastAPI', 'Ollama'],
    href: 'https://github.com/BrandNewDevs/WorkBench',
  },
  {
    name: 'DigiLicense',
    mark: 'DL',
    description:
      'A frontend prototype for a clearer driving-licence service in India. It covers service discovery and application tracking, but does not submit to a government system.',
    stack: ['React', 'TanStack Start', 'TypeScript', 'Tailwind CSS'],
    href: 'https://github.com/BrandNewDevs/DigiLicense',
  },
]

const contactEmail = 'kritiraj.tech@gmail.com'

function EmailSocialLink() {
  const [copyStatus, setCopyStatus] = useState<'idle' | 'copied' | 'error'>('idle')

  async function copyEmail() {
    try {
      await navigator.clipboard.writeText(contactEmail)
      setCopyStatus('copied')
      window.setTimeout(() => setCopyStatus('idle'), 1500)
    } catch {
      setCopyStatus('error')
      window.setTimeout(() => setCopyStatus('idle'), 1500)
    }
  }

  return (
    <span className="email-social-link inline-flex items-center">
      <Tooltip content={copyStatus === 'copied' ? 'Copied to clipboard' : copyStatus === 'error' ? 'Could not copy email' : 'Click to copy email'} side="top">
        <button
          aria-label={copyStatus === 'copied' ? 'Email copied to clipboard' : copyStatus === 'error' ? 'Could not copy email' : 'Copy email address'}
          className="email-trigger inline-flex items-center gap-1.5 leading-none text-muted-foreground hover:text-foreground focus-visible:text-foreground"
          onClick={copyEmail}
          type="button"
        >
          <FiMail aria-hidden="true" className="size-4 shrink-0" />
          {contactEmail}
        </button>
      </Tooltip>
      <span aria-live="polite" className="sr-only">
        {copyStatus === 'copied' ? 'Email address copied to clipboard.' : copyStatus === 'error' ? 'Could not copy email address.' : ''}
      </span>
    </span>
  )
}

const bannerTransition = { type: 'spring', visualDuration: 1.2, bounce: 0 } as const
const desktopProjectsQuery = '(min-width: 768px)'

function subscribeToDesktopProjects(onChange: () => void) {
  const mediaQuery = window.matchMedia(desktopProjectsQuery)
  mediaQuery.addEventListener('change', onChange)
  return () => mediaQuery.removeEventListener('change', onChange)
}

function isDesktopProjectsWidth() {
  return window.matchMedia(desktopProjectsQuery).matches
}

function App() {
  const { theme } = useTheme()
  const reducedMotion = useReducedMotion()
  const shaderColors = useMemo(() => {
    const styles = getComputedStyle(document.documentElement)
    return {
      back: styles.getPropertyValue('--background').trim(),
      front: styles.getPropertyValue('--portfolio-blue').trim(),
    }
  }, [theme])
  const contentInitial = reducedMotion ? { opacity: 0 } : { opacity: 0, transform: 'translate3d(0, 8px, 0)' }
  const contentAnimate = reducedMotion ? { opacity: 1 } : { opacity: 1, transform: 'translate3d(0, 0, 0)' }
  const contentTransition = reducedMotion
    ? { duration: 0.2, ease: EASE_OUT }
    : { duration: 0.36, ease: EASE_OUT, delay: 1.12 }
  const desktopProjects = useSyncExternalStore(subscribeToDesktopProjects, isDesktopProjectsWidth, () => false)
  const [projectView, setProjectView] = useState<'grid' | 'list'>('grid')
  const visibleProjectView = desktopProjects ? projectView : 'grid'

  function changeProjectView(nextView: string) {
    if (nextView !== 'grid' && nextView !== 'list') return
    if (nextView === projectView) return

    if (typeof document.startViewTransition !== 'function') {
      setProjectView(nextView)
      return
    }

    document.startViewTransition(() => {
      flushSync(() => setProjectView(nextView))
    })
  }

  return (
    <div id="top" className="relative min-h-svh overflow-x-clip bg-background text-foreground">
      <ThemeDotCursor />
      <DraggableDecorations />
      <div className="mx-auto w-full max-w-3xl px-6 sm:px-8">
        <main className="flex flex-col gap-14 pb-12 sm:gap-16 sm:pb-16">
          <section
            id="profile"
            aria-labelledby="profile-name"
          >
            <div
              className="relative left-1/2 h-72 w-screen -translate-x-1/2 overflow-hidden bg-background text-foreground sm:h-96"
            >
              <motion.div
                aria-hidden="true"
                className="pointer-events-none absolute inset-0"
                initial={reducedMotion ? { opacity: 0 } : { clipPath: 'polygon(0 0, 0 0, 0 100%, 0 100%)' }}
                animate={reducedMotion ? { opacity: 1 } : { clipPath: 'polygon(0 0, 116% 0, 100% 100%, 0 100%)' }}
                transition={reducedMotion ? { duration: 0.2, ease: EASE_OUT } : bannerTransition}
              >
                <Dithering
                  className="absolute inset-0"
                  width="100%"
                  height="100%"
                  colorBack={shaderColors.back}
                  colorFront={shaderColors.front}
                  shape="simplex"
                  type="4x4"
                  size={4}
                  speed={reducedMotion ? 0 : 0.3}
                  scale={0.4}
                  rotation={70}
                  offsetX={-0.4}
                />
                {!reducedMotion && (
                  <motion.span
                    className="banner-shimmer"
                    initial={{ transform: 'translate3d(0%, 0, 0) skewX(-16deg)' }}
                    animate={{ transform: 'translate3d(116%, 0, 0) skewX(-16deg)' }}
                    transition={bannerTransition}
                  />
                )}
              </motion.div>
            </div>
            <div className="relative z-20 -mt-24 flex flex-col gap-5 sm:-mt-32 sm:gap-6">
              <motion.img
                src={profilePicture}
                alt="Kritiraj's profile picture"
                className="size-44 rounded-lg border-8 border-background bg-background object-contain sm:size-56"
                fetchPriority="high"
                initial={reducedMotion ? { opacity: 0 } : { opacity: 0, transform: 'translate3d(0, 12px, 0)' }}
                animate={reducedMotion ? { opacity: 1 } : { opacity: 1, transform: 'translate3d(0, 0, 0)' }}
                transition={reducedMotion ? { duration: 0.2, ease: EASE_OUT } : { duration: 0.42, ease: EASE_OUT, delay: 0.7 }}
              />
              <motion.div
                className="absolute right-0 top-48 flex w-full items-center justify-end gap-2 sm:top-32"
                initial={contentInitial}
                animate={contentAnimate}
                transition={contentTransition}
              >
                <ViewerCounter />
                <Tooltip content={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`} side="bottom">
                  <ThemeToggle />
                </Tooltip>
              </motion.div>
              <motion.div
                initial={contentInitial}
                animate={contentAnimate}
                transition={contentTransition}
              >
                <h1 id="profile-name" className="text-3xl font-medium tracking-tight sm:text-4xl">Kritiraj (Kenny)</h1>
                <p className="mt-1 text-sm text-muted-foreground">Aspiring Design Engineer</p>
                <p className="mt-4 max-w-lg text-sm leading-6">
                  I design and build simple web interfaces that feel satisfying to use. I care about the details in how they look and respond, as well as usability, speed, and accessibility. I'm looking for a design engineering internship.
                </p>
                <nav aria-label="Social links" className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-muted-foreground">
                  <Tooltip content="Follow on X">
                    <a aria-label="Follow on X" className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-border bg-background px-2.5 font-medium transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" href="https://x.com/wkknyy" target="_blank" rel="noreferrer">
                      Follow on
                      <FaXTwitter aria-hidden="true" />
                    </a>
                  </Tooltip>
                  <Tooltip content="Visit GitHub profile">
                    <a className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-border bg-background px-2.5 font-medium transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" href="https://github.com/wkkny" target="_blank" rel="noreferrer">
                      GitHub
                      <FiGithub aria-hidden="true" />
                    </a>
                  </Tooltip>
                  <EmailSocialLink />
                </nav>
                <div className="mt-5 w-fit max-w-xs">
                  <SpotifyStatus />
                </div>
              </motion.div>
            </div>
          </section>

          <section id="github-activity" aria-label="GitHub contributions" className="-mt-6 sm:-mt-8">
            <a
              className="animated-arrow-link mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground"
              href="https://github.com/wkkny"
              target="_blank"
              rel="noreferrer"
            >
              <span className="animated-arrow-link-label relative">wkkny</span>
              <FiArrowUpRight aria-hidden="true" className="animated-arrow-link-icon size-3.5" />
            </a>
            <GitHubActivity />
          </section>

          <motion.section
            id="projects"
            aria-labelledby="projects-heading"
            initial={reducedMotion ? false : { opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true, amount: 0.15 }}
            transition={reducedMotion ? { duration: 0 } : { duration: 0.4, ease: EASE_OUT }}
          >
            <div className="mb-7 flex flex-wrap items-end justify-between gap-4">
              <h2 id="projects-heading" className="text-2xl font-medium tracking-tight sm:text-3xl">Projects</h2>
              <div className="flex flex-wrap items-center gap-3">
                <a
                  className="animated-arrow-link inline-flex items-center gap-1 text-sm text-muted-foreground"
                  href="https://github.com/wkkny?tab=repositories"
                  target="_blank"
                  rel="noreferrer"
                >
                  <span className="animated-arrow-link-label relative">All repositories</span>
                  <FiArrowUpRight aria-hidden="true" className="animated-arrow-link-icon size-3.5" />
                </a>
                {desktopProjects ? (
                  <ToggleGroup
                    aria-label="Project view"
                    value={[projectView]}
                    onValueChange={(values) => changeProjectView(values[0])}
                    variant="outline"
                    size="sm"
                  >
                    <Tooltip content="Grid view">
                      <ToggleGroupItem value="grid" aria-label="Grid view">
                        <FiGrid aria-hidden="true" />
                      </ToggleGroupItem>
                    </Tooltip>
                    <Tooltip content="List view">
                      <ToggleGroupItem value="list" aria-label="List view">
                        <FiList aria-hidden="true" />
                      </ToggleGroupItem>
                    </Tooltip>
                  </ToggleGroup>
                ) : null}
              </div>
            </div>
            <div className={visibleProjectView === 'grid' ? 'grid gap-5 md:grid-cols-2' : 'flex flex-col divide-y divide-border'}>
              {projects.map((project) => (
                <Card
                  key={project.name}
                  className={visibleProjectView === 'grid' ? 'h-full' : 'flex-row items-stretch rounded-none bg-transparent py-4 ring-0'}
                  style={{ viewTransitionName: `project-${project.name.toLowerCase()}` }}
                >
                  {visibleProjectView === 'list' && (
                    <div className="flex w-32 shrink-0 items-center p-3 sm:w-40">
                      <Avatar className="size-24 rounded-lg after:rounded-lg sm:size-32">
                        <AvatarFallback className="rounded-lg bg-muted text-xl font-medium text-muted-foreground">
                          {project.mark}
                        </AvatarFallback>
                      </Avatar>
                    </div>
                  )}
                  <div className={visibleProjectView === 'list' ? 'min-w-0 flex-1' : undefined}>
                    <CardHeader className="gap-3">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div className="flex min-w-0 items-center gap-3">
                          {visibleProjectView === 'grid' && (
                            <Avatar size="lg" className="rounded-lg after:rounded-lg">
                              <AvatarFallback className="rounded-lg bg-muted text-xs font-medium text-muted-foreground">
                                {project.mark}
                              </AvatarFallback>
                            </Avatar>
                          )}
                          <CardTitle>{project.name}</CardTitle>
                        </div>
                        <a
                          className="inline-flex shrink-0 items-center gap-2 text-sm font-medium transition-colors hover:text-muted-foreground"
                          href={project.href}
                          target="_blank"
                          rel="noreferrer"
                        >
                          GitHub <FiArrowUpRight aria-hidden="true" />
                        </a>
                      </div>
                      <p className={`${visibleProjectView === 'grid' ? 'min-h-20 ' : ''}leading-6 text-muted-foreground`}>
                        {project.description}
                      </p>
                    </CardHeader>
                    <CardContent className={visibleProjectView === 'grid' ? 'flex flex-1 flex-col' : 'space-y-4'}>
                      <ul aria-label={`${project.name} technologies`} className="flex flex-wrap gap-x-3 gap-y-1">
                        {project.stack.map((item) => (
                          <li key={item} className="text-xs text-muted-foreground/70">{item}</li>
                        ))}
                      </ul>
                    </CardContent>
                  </div>
                </Card>
              ))}
            </div>
            <ProjectStatus />
          </motion.section>
        </main>
        <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-border py-6 text-sm text-muted-foreground">
          <p>© {new Date().getFullYear()} Kritiraj (Kenny)</p>
          <p className="inline-flex items-center gap-1.5">
            <FiMapPin aria-hidden="true" />
            New Delhi
          </p>
        </footer>
      </div>
    </div>
  )
}

export default App
