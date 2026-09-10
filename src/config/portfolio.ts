type HttpsUrl = `https://${string}`

export type PortfolioProject = {
  name: string
  description: string
  destinations: {
    website?: HttpsUrl | '#'
    repository?: HttpsUrl
  }
  stack: readonly string[]
}

type PortfolioConfig = {
  profile: {
    displayName: string
    monogram: string
    homeLabel: string
    roles: readonly string[]
    occupation: string
    location: {
      label: string
      timeZone: string
    }
    note: {
      label: string
      highlight: string
    }
    pronouns: string
  }
  links: {
    email: {
      label: string
      address: string
      href: `mailto:${string}`
    }
    github: {
      label: string
      username: string
      href: HttpsUrl
    }
  }
  projects: readonly PortfolioProject[]
}

const emailAddress = 'kritiraj.tech@gmail.com'
const githubBaseUrl = 'https://github.com'
const githubUsername = 'wkkny'

export const portfolio = {
  profile: {
    displayName: 'Kritiraj B',
    monogram: 'KB',
    homeLabel: "Kritiraj's Portfolio",
    roles: [
      'Full Stack Developer.',
      'UI/UX Designer.',
      'I love terminal apps.',
    ],
    occupation: 'Full Stack Developer',
    location: {
      label: 'New Delhi, India',
      timeZone: 'Asia/Kolkata',
    },
    note: {
      label: 'I used to use Arch btw',
      highlight: 'Arch',
    },
    pronouns: 'he/him',
  },
  links: {
    email: {
      label: 'Email',
      address: emailAddress,
      href: `mailto:${emailAddress}`,
    },
    github: {
      label: 'GitHub',
      username: githubUsername,
      href: `${githubBaseUrl}/${githubUsername}`,
    },
  },
  projects: [
    {
      name: 'placeholder-one',
      description: 'A placeholder project title.',
      destinations: {
        repository: githubBaseUrl,
      },
      stack: ['React', 'TypeScript', 'Vite'],
    },
    {
      name: 'placeholder-two',
      description: 'A placeholder project title.',
      destinations: {},
      stack: ['Python', 'FastAPI'],
    },
    {
      name: 'placeholder-three',
      description: 'A placeholder project title.',
      destinations: {
        repository: githubBaseUrl,
      },
      stack: ['Go', 'PostgreSQL'],
    },
  ],
} satisfies PortfolioConfig
