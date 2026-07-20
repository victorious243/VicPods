# Phase 6: Teams And Pro Workflows

Date: 2026-07-20

## Goal

Support serious creators, agencies, and networks that manage more than one show or more than one production role.

## Implemented

- Show collaborators with roles: owner, producer, editor, analyst, guest.
- Role-derived permissions for editing, approval, analytics, and publishing management.
- Show brand kit fields: positioning, voice rules, visual notes, sponsor safety notes, approved phrases, banned phrases.
- Episode comments and tasks through EpisodeWorkItem.
- Episode approval workflow: not started, in review, changes requested, approved.
- Multi-show team dashboard at /studio/teams.
- Episode-level Team Workflow panel for comments, tasks, and approval state.
- Phase 6 tests for collaborator normalization, brand kit normalization, work items, approval status, workflow grouping, and schema coverage.

## Routes

- /studio/teams - multi-show team dashboard.
- /studio/teams/shows/:showId/collaborators - add or update a collaborator.
- /studio/teams/shows/:showId/brand-kit - save brand kit.
- /kitchen/:seriesId/themes/:themeId/episodes/:episodeId/work-items - add episode comment/task.
- /kitchen/:seriesId/themes/:themeId/episodes/:episodeId/approval - update episode approval state.

## Notes

- This phase models collaborators and roles inside the owner account workspace. It does not yet implement separate collaborator login or authorization enforcement.
- Inviting collaborators does not send email yet. The app records invited collaborators so agency workflows can be planned before external invite delivery is added.
- Approval status is operational metadata. Publishing is not blocked by approval yet; that can become a Premium/agency enforcement rule later.
