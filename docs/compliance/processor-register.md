# VicPods Processor Register

Internal processor list and DPA checklist. Do not mark items as complete unless the contract or DPA has been reviewed and signed where needed.

| Processor / vendor | Purpose | Data categories | Cross-border risk | DPA / terms status | Owner action |
| --- | --- | --- | --- | --- | --- |
| MongoDB Atlas | Database hosting and storage | Account data, podcast content, logs, settings | Confirm region and transfer basis | `[ ]` Review / sign if required | Confirm hosting region and DPA terms |
| Stripe | Billing, subscriptions, customer portal | Billing identifiers, subscription metadata, customer email/name | Yes, depending on account setup | `[ ]` Review Stripe DPA / data terms | Confirm Stripe account legal settings |
| Brevo / SMTP provider | Transactional email delivery | Email address, transactional message content | Yes, depending on provider setup | `[ ]` Review provider DPA / terms | Confirm sender domain and DPA |
| Google Identity / OIDC | Optional login | Email, name, Google subject ID | Yes | `[ ]` Review Google data terms | Confirm OAuth app legal posture |
| OpenAI | AI-assisted generation | Prompts and user-created podcast content sent for generation | Yes | `[ ]` Review OpenAI data processing terms | Confirm enterprise/business terms and retention settings |
| Cookiebot / Usercentrics | Consent management | Consent state, cookie preferences, browser identifiers | Yes | `[ ]` Review Cookiebot DPA / terms | Confirm CMP contract and records |
| Hosting / runtime provider | App hosting and delivery | Request metadata, sessions, app traffic | Confirm actual provider | `[ ]` Review provider DPA / terms | Fill in actual provider name |
| Support / mailbox provider | Privacy requests and support | Contact details, support/DSAR content | Confirm actual provider | `[ ]` Review provider DPA / terms | Fill in actual provider name |

## Completion Checklist

- [ ] Each processor is confirmed and not just assumed from source code.
- [ ] Region / hosting location is documented.
- [ ] DPA or controller-processor terms are filed.
- [ ] Transfer mechanism is documented where required.
- [ ] Security/contact owner is assigned for each processor.
