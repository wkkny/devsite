import { PiMicrosoftOutlookLogoBold } from 'react-icons/pi'
import { TbBrandGmail, TbInbox } from 'react-icons/tb'

import { portfolioOwner } from '@/data'

const emailTo = encodeURIComponent(portfolioOwner.email)
// A subject that says where the email came from, so it stands out in an inbox and is easy to find
// later. No body: the visitor knows what they want to say, and Gmail would put the cursor before
// any text we prefilled.
const emailSubject = encodeURIComponent('Reaching out via your portfolio')

// No browser API says which mail app a visitor uses, so they pick. The webmail links are
// undocumented compose URLs; the mail app is whatever the visitor's system handles mailto with.
export const mailClients = [
  {
    id: 'gmail',
    label: 'Gmail',
    opened: 'Opened Gmail',
    Icon: TbBrandGmail,
    // tf=cm is what opens the compose view now; view=cm is the older spelling.
    href: `https://mail.google.com/mail/?fs=1&to=${emailTo}&su=${emailSubject}&tf=cm`,
  },
  {
    id: 'outlook',
    label: 'Outlook',
    opened: 'Opened Outlook',
    // Phosphor's bold weight, since Tabler has no Outlook and its regular reads thinner.
    Icon: PiMicrosoftOutlookLogoBold,
    href: `https://outlook.office.com/mail/deeplink/compose?to=${emailTo}&subject=${emailSubject}`,
  },
  {
    id: 'mailto',
    label: 'Mail app',
    // Nothing reports whether a mail app answered, so this one only says it is trying.
    opened: 'Opening app',
    Icon: TbInbox,
    href: `mailto:${portfolioOwner.email}?subject=${emailSubject}`,
  },
] as const

export type MailClient = (typeof mailClients)[number]

export const mailApp = mailClients.find((client) => client.id === 'mailto')!
