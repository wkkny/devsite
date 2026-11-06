import profilePicture from '@/assets/profile-picture.webp'

export const portfolioOwner = {
  displayName: 'Kritiraj',
  role: 'Software Engineer',
  bio: "I design and build simple web interfaces that feel satisfying to use. I care about the details in how they look and respond, as well as usability, speed, and accessibility. I'm looking for a software engineering internship.",
  email: 'kritiraj.tech@gmail.com',
  location: 'New Delhi',
  profilePicture,
  profilePictureAlt: "Kritiraj's profile picture",
  githubUsername: 'wkkny',
  githubUrl: 'https://github.com/wkkny',
  githubRepositoriesUrl: 'https://github.com/wkkny?tab=repositories',
  xUrl: 'https://x.com/wkknyy',
  visitorCounterUrl: '/api/visitors',
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
    name: 'Elegant',
    mark: 'EL',
    description:
      'A macOS menu-bar app that notices when you join an online call, offers to record it, and writes a local transcript and summary with citations. You can then ask questions about the meeting.',
    stack: ['Electron', 'React', 'TypeScript', 'Swift', 'WhisperKit', 'Ollama'],
    href: 'https://github.com/BrandNewDevs/Elegant',
  },
  {
    name: 'WorkBench',
    mark: 'WB',
    description:
      'A local-first AI workbench for confidential industrial documents. The repo has a Windows desktop UI and an Ollama adapter. Its inspection workflow is still in progress.',
    stack: ['Electron', 'React', 'TypeScript', 'FastAPI', 'Ollama'],
    href: 'https://github.com/BrandNewDevs/WorkBench',
  },
] as const

export type PortfolioProject = (typeof projects)[number]
