import { portfolioOwner } from '@/data'

export function SiteFooter() {
  return (
    <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-border py-6 text-sm text-muted-foreground">
      <p>© {new Date().getFullYear()} {portfolioOwner.displayName}</p>
    </footer>
  )
}
