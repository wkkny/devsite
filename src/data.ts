import profilePicture from '@/assets/profile-picture.png'

export const portfolioOwner = {
  displayName: 'Kritiraj (Kenny)',
  role: 'Aspiring Design Engineer',
  bio: "I design and build simple web interfaces that feel satisfying to use. I care about the details in how they look and respond, as well as usability, speed, and accessibility. I'm looking for a design engineering internship.",
  email: 'kritiraj.tech@gmail.com',
  location: 'New Delhi',
  profilePicture,
  profilePictureAlt: "Kritiraj's profile picture",
  githubUsername: 'wkkny',
  githubUrl: 'https://github.com/wkkny',
  githubRepositoriesUrl: 'https://github.com/wkkny?tab=repositories',
  xUrl: 'https://x.com/wkknyy',
  visitorCounterUrl: 'https://counterapi.com/api/wkkny-devsite/view/home',
} as const

export const socialLinks = [
  {
    platform: 'x',
    label: 'Follow on X',
    text: 'Follow on',
    href: portfolioOwner.xUrl,
    ariaLabel: 'Follow on X',
  },
  {
    platform: 'github',
    label: 'Visit GitHub profile',
    text: 'GitHub',
    href: portfolioOwner.githubUrl,
  },
] as const

export const projects = [
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
] as const

export type PortfolioProject = (typeof projects)[number]
