# VicPods Records Of Processing Activities

Internal working document for Article 30-style accountability. This is operational guidance, not legal advice.

## Controller Profile

| Field | Current value / source | Action |
| --- | --- | --- |
| Controller identity | `LEGAL_ENTITY_NAME` / `LEGAL_TRADING_NAME` env vars | Confirm formal legal entity before production launch |
| Main privacy contact | `PRIVACY_CONTACT_EMAIL` env var | Confirm inbox ownership and response workflow |
| Support contact | `SUPPORT_CONTACT_EMAIL` env var | Confirm inbox ownership |
| Main establishment / country | `LEGAL_COUNTRY` env var | Confirm if Ireland remains the main establishment |

## Processing Activities

| Activity | Data subjects | Personal data | Purpose | Lawful basis | Systems | Processors / recipients | Transfers | Retention note |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Account registration and sign-in | Creators / users | Name, email, password hash, auth provider, session ID, verification metadata | Create accounts and secure access | Contract, legitimate interests, legal obligations where applicable | MongoDB, Express session store, auth flows | MongoDB Atlas, Google (optional), email provider | Confirm hosting/provider transfer basis | Keep while account is active; see retention schedule |
| Product workflow and podcast content | Creators / users | Series, themes, episodes, Pantry ideas, settings, launch assets | Deliver the VicPods product | Contract | MongoDB, app services, AI features | AI provider, hosting/database provider | Confirm AI/provider transfer basis | Keep while account is active unless deleted sooner |
| Billing and subscription management | Paying users | Stripe customer/subscription IDs, plan status, billing lifecycle metadata | Run subscriptions and billing | Contract, legal obligations | Stripe integration, billing controllers | Stripe | Confirm transfer basis | Financial/billing records may outlast app account deletion |
| Service email delivery | Users | Email address, transactional email content | Verification, security, billing, onboarding, lifecycle messaging | Contract, legitimate interests | Email services | Brevo / SMTP provider | Confirm provider location and transfer basis | Retain email event metadata per retention schedule |
| First-party analytics and admin monitoring | Visitors and users | Visitor ID, page views, login/sign-up events, request path, IP, user agent, account email where linked | Product operations, abuse prevention, admin visibility | Legitimate interests | App activity logs, admin dashboard | Hosting/database provider | Confirm hosting/provider transfer basis | See retention schedule; shorten where possible |
| Privacy / data rights handling | Requesting users | Contact details, request details, identity-verification data, resolution notes | Respond to privacy requests | Legal obligations, legitimate interests | Help/support workflow, compliance docs | Support inbox / operator | Confirm inbox provider transfer basis | Keep request records only as long as needed to prove handling |

## Current Gaps To Track

- Confirm every processor location and international transfer mechanism.
- Confirm whether main establishment is Ireland or another jurisdiction.
- Define exact retention windows in implementation, not only policy.
- Decide whether analytics/admin logs need automated deletion.
