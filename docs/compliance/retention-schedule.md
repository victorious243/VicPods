# VicPods Retention Schedule

Internal working schedule. This is a policy target and implementation checklist, not legal advice.

| Data set | Current application behavior | Target retention | Notes / action |
| --- | --- | --- | --- |
| User account record | Stored until account deletion | While account is active | Current deletion flow removes the user immediately from app data |
| Series / themes / episodes / Pantry ideas | Stored until deleted by user or account deletion | While account is active or until user deletes | Current account deletion removes these records |
| Session cookie / active session | Expires by session config | 14 days max unless session ends earlier | Confirm if production session lifetime remains appropriate |
| Verification and MFA data | Short-lived operational data | Minutes to days only | Review and prune expired verification artifacts regularly |
| App activity events | Stored in database | Set a fixed operational window, e.g. 90 to 180 days | Current implementation does not auto-prune; add retention job later |
| Admin access logs | Stored in database | Set a fixed security window, e.g. 90 to 180 days | Current implementation does not auto-prune; add retention job later |
| Billing metadata in app | Stored while user/billing link exists | Keep while subscription relationship exists, then keep only what is necessary | Stripe remains system of record for billing artifacts |
| Stripe records | Managed by Stripe | Per Stripe/legal/accounting requirements | Confirm with Stripe retention and finance obligations |
| Transactional email metadata | Depends on provider | Keep only as long as needed for delivery, abuse prevention, or legal compliance | Confirm Brevo retention and export options |
| Privacy request records | Not yet separately modelled in app | Keep long enough to prove response and defend complaints | Formal DSAR log process added in workflow docs |
| Backups / database snapshots | Not explicitly documented in app | Confirm with infrastructure provider | Must be documented before final compliance sign-off |

## Implementation Priorities

1. Add automated pruning for `AppActivityEvent`.
2. Add automated pruning for `AdminAccessLog`.
3. Document backup retention with the hosting/database provider.
4. Review whether some billing-linked identifiers should remain after account deletion for fraud or finance purposes.
