import { PrismaClient } from '../generated/client'
const prisma = new PrismaClient()

async function main() {
  await prisma.termsVersion.upsert({
    where: { version: '1.0.0' },
    create: {
      version: '1.0.0',
      effectiveAt: new Date('2026-01-01'),
      content: `ARIVARANGAM TERMS OF SERVICE

Version 1.0.0 | Effective January 1, 2026

1. ACCEPTANCE OF TERMS
By accessing or using Arivarangam, you agree to be bound by these Terms of Service and our Privacy Policy.

2. DESCRIPTION OF SERVICE
Arivarangam is an AI orchestration platform that enables users to collaborate with multiple AI models for professional tasks.

3. COMMUNITY SAFETY AND PLATFORM INTEGRITY
Arivarangam is a professional platform committed to maintaining a safe and lawful environment for all users. To protect our community and comply with applicable laws, Arivarangam monitors platform activity including messages, shared content, and user interactions for the purpose of detecting and preventing illegal activity, harassment, fraud, and violations of these Terms.

This monitoring is conducted solely for platform safety and legal compliance purposes. Arivarangam does not use message content for advertising or share it with third parties except as required by law.

By using Arivarangam, you acknowledge and consent to this monitoring as a condition of platform access.

Arivarangam reserves the right to suspend or terminate accounts found to be in violation of these Terms or applicable law, and to cooperate with law enforcement authorities where required.

4. USER CONDUCT
You agree not to use Arivarangam to:
- Upload, post, or transmit any illegal, harmful, or offensive content
- Harass, abuse, or harm other users
- Impersonate any person or entity
- Violate any applicable laws or regulations

5. PRIVACY
Your use of Arivarangam is subject to our Privacy Policy. By using Arivarangam, you consent to the collection and use of information as described therein.

6. TERMINATION
Arivarangam reserves the right to terminate or suspend your account at any time for violation of these Terms.

7. CONTACT
For questions about these Terms, contact support@arivarangam.com`
    },
    update: {}
  })
  console.log('Terms version 1.0.0 seeded')
}

main().catch(console.error).finally(() => prisma.$disconnect())
