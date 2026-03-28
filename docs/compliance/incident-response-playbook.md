# VicPods Incident Response And Breach Notification Playbook

Internal operational playbook. This is practical guidance, not legal advice.

## 1. Trigger

Treat the event as a potential security incident if any of the following occurs:

- suspected unauthorised access to user accounts or admin systems
- unexpected data exposure, export, or deletion
- compromise of payment, authentication, or email systems
- suspicious admin-access or log activity
- third-party vendor notification affecting VicPods data

## 2. First Hour

1. Open an incident record with date, reporter, and summary.
2. Contain the issue:
   - disable exposed credentials
   - rotate secrets
   - restrict affected routes or admin access
   - suspend vulnerable integrations if needed
3. Preserve evidence:
   - application logs
   - admin access logs
   - activity logs
   - provider notifications
4. Identify whether personal data may be involved.

## 3. First 24 Hours

1. Classify severity:
   - no personal data impact
   - possible personal data impact
   - confirmed personal data breach
2. Identify affected categories:
   - account data
   - podcast content
   - billing metadata
   - authentication/security data
3. Estimate affected users and systems.
4. Decide whether external processor notifications are required.

## 4. 72-Hour Breach Decision Window

If a personal data breach is likely to result in a risk to individuals, assess whether supervisory authority notification is required. Document:

- what happened
- what data was involved
- likely consequences
- mitigation steps taken
- whether users need direct notice

If VicPods operates with Ireland as main establishment, review whether the Irish Data Protection Commission is the relevant authority.

## 5. User Communication

If users need to be informed:

- use plain language
- explain what happened
- explain what data may be affected
- explain what VicPods has done already
- tell users what action, if any, they should take

## 6. Recovery

- patch the root cause
- rotate relevant credentials
- verify affected systems are stable
- review whether additional monitoring is needed

## 7. Post-Incident Review

Within 7 days after containment:

- document root cause
- document remediation
- document retention and notification decisions
- create follow-up engineering tasks
- update legal / privacy records if the processing picture changed
