# Quiz tags, markers & Learning Path

The tag normaliser, hygiene panel, tagList mirror, legacy markers, and the AI Learning Path strip with tag promotion.

## How to get to it (user POV)

Admin: Quiz Engine ▸ Tag hygiene; Learning Path strip.

## Scripts that drive it

- `quiz-tag-hygiene-check` — computeQuizTagHygiene over every bucket
- `quiz-tag-normalize-check` — normaliser + autocomplete helpers
- `quiz-taglist-mirror-check` — tagList mirror: no consumer parses tags on its own
- `quiz-marker-fields-check` — markers out of tags (legacy migration helpers)
- `lp-discover-quiz-tags-check` — Tag promotion Discover scans quiz tags
- `learning-path-strip-qa` — AI Learning Path strip as one lean row

## What usually lies

- These extract helpers VERBATIM from admin.html by marker strings; renaming a function breaks the extractor before any behaviour is tested — read the error, it names the marker.
