# Skill pending updates (for human review)

- Fresh `/tmp` scratch clones have no git identity configured (no global `~/.gitconfig` on the device VM) — first `git commit` fails with "Author identity unknown". Fix: `git config user.email "kentt@theboardroombrief.local"` and `git config user.name "Kent"` (read from the mounted repo's local config, which does have it set) before committing in the scratch clone.
