# CLAUDE.md - INTERN-PORT Project Guidelines

Behavioral guidelines to reduce common LLM coding mistakes, customized for the INTERN-PORT project.

**Tradeoff:** These guidelines bias toward caution over speed. For trivial tasks, use judgment.

**Read [THINKING-PLAYBOOK.md](THINKING-PLAYBOOK.md) alongside this file.** This file says what the rules are for this codebase; the playbook says how to work — build a model before editing, cut the task into slices you can prove done, verify at the surface the user actually sees, and report what you observed rather than what you hoped. Where the two overlap, this file wins on project specifics.

---

## Karpathy-Inspired Core Principles

### 1. Think Before Coding
**Don't assume. Don't hide confusion. Surface tradeoffs.**

Before implementing:
- State your assumptions explicitly. If uncertain, ask.
- If multiple interpretations exist, present them - don't pick silently.
- If a simpler approach exists, say so. Push back when warranted.
- If something is unclear, stop. Name what's confusing. Ask.

### 2. Simplicity First
**Minimum code that solves the problem. Nothing speculative.**

- No features beyond what was asked.
- No abstractions for single-use code.
- No "flexibility" or "configurability" that wasn't requested.
- No error handling for impossible scenarios.
- If you write 200 lines and it could be 50, rewrite it.

Ask yourself: "Would a senior engineer say this is overcomplicated?" If yes, simplify.

### 3. Surgical Changes
**Touch only what you must. Clean up only your own mess.**

When editing existing code:
- Don't "improve" adjacent code, comments, or formatting.
- Don't refactor things that aren't broken.
- Match existing style, even if you'd do it differently.
- If you notice unrelated dead code, mention it - don't delete it.

When your changes create orphans:
- Remove imports/variables/functions that YOUR changes made unused.
- Don't remove pre-existing dead code unless asked.

The test: Every changed line should trace directly to the user's request.

### 4. Goal-Driven Execution
**Define success criteria. Loop until verified.**

Transform tasks into verifiable goals:
- "Add validation" → "Write tests for invalid inputs, then make them pass"
- "Fix the bug" → "Write a test that reproduces it, then make it pass"
- "Refactor X" → "Ensure tests pass before and after"

For multi-step tasks, state a brief plan:
```
1. [Step] → verify: [check]
2. [Step] → verify: [check]
3. [Step] → verify: [check]
```

---

## INTERN-PORT Project-Specific Guidelines

### Project Architecture
- **Main Files**: `index.html` (user interface), `admin.html` (admin interface)
- **Backend**: Firebase Firestore with specific collections (`users`, `quiz_attempts`, `quests`, etc.)
- **Frontend**: Vanilla JavaScript with LIFF integration
- **Styling**: Inline CSS with responsive design
- **Version Control**: Git with semantic versioning (V.XX.XX format)

### Code Style & Patterns
- **JavaScript**: Use existing patterns, maintain global variable structure
- **HTML**: Follow existing semantic structure and class naming conventions
- **CSS**: Use existing color scheme and responsive breakpoints
- **Firebase**: Follow existing query patterns and error handling
- **LIFF Integration**: Maintain existing authentication flow

### Critical Rules
1. **Never break existing LIFF authentication flow**
2. **Always test both user and admin interfaces when applicable**
3. **Maintain backward compatibility with existing data structures**
4. **Use existing global variables and naming conventions**
5. **Follow the established modal and card UI patterns**

### Common Tasks & Verification Loops

#### Adding New Features
```
1. Plan feature implementation → verify: requirements understood
2. Update HTML structure → verify: markup validates, responsive
3. Add CSS styling → verify: matches existing design, mobile-friendly
4. Implement JavaScript logic → verify: no console errors, integrates properly
5. Test with sample data → verify: feature works end-to-end
6. Update version numbers → verify: consistent across files
```

#### Firebase Integration
```
1. Define collection structure → verify: follows existing patterns
2. Implement read operations → verify: handles loading states, errors
3. Implement write operations → verify: proper validation, security rules
4. Test with real data → verify: CRUD operations work correctly
5. Add error handling → verify: graceful failure handling
```

#### UI/UX Updates
```
1. Update HTML structure → verify: semantic, accessible
2. Apply CSS changes → verify: responsive, matches design system
3. Add JavaScript interactions → verify: smooth, no conflicts
4. Test on mobile devices → verify: touch-friendly, readable
5. Test accessibility → verify: keyboard navigation, screen readers
```

### Data Structure Guidelines
- **Users Collection**: Follow existing schema (displayName, pictureUrl, score, group, etc.)
- **Quiz Collections**: Maintain existing question structure and scoring
- **Quest Collections**: Follow existing task and submission patterns
- **New Collections**: Use consistent naming, include timestamps, user references

### Testing & Verification
- **Manual Testing**: Always test in both LIFF and browser environments
- **Mobile Testing**: Verify on actual mobile devices when possible
- **Data Integrity**: Ensure no data loss during schema changes
- **Performance**: Monitor for slow queries or DOM operations
- **Cross-browser**: Test in Chrome, Safari, Firefox when applicable

### Branching & Deployment

- **Trunk branch: `production`** (default branch on GitHub as of 2026-05-01). Base every feature branch from `origin/production`, target PRs at `production`.
- **`main` is legacy** — kept temporarily for safety. Do not branch from it. Dependabot may still target it; cherry-pick to `production` when needed.
- **GitHub Pages** deploys via `.github/workflows/deploy.yml` on push to `production` (serves `public/`).
- **Live URLs**: https://mlpditto.github.io/INTERN-PORT/ (intern, LIFF-gated) and https://mlpditto.github.io/INTERN-PORT/admin.html (admin).

```
1. Update version numbers → verify: consistent in public/index.html, public/admin.html
2. Test locally → verify: all features work, no console errors
3. Commit changes → verify: descriptive commit message
4. Open PR against production → verify: CI green
5. Merge → workflow deploys → verify: live site updated
```

### Security Considerations
- **Firebase Security Rules**: Never weaken existing rules
- **Data Validation**: Always validate user inputs on both client and server
- **Authentication**: Maintain existing LIFF authentication flow
- **Sensitive Data**: Never expose API keys or sensitive information in frontend

### Performance Guidelines
- **Bundle Size**: Keep HTML files as lean as possible
- **Firebase Queries**: Use efficient queries, avoid large data transfers
- **DOM Manipulation**: Minimize reflows and repaints
- **Image Optimization**: Use appropriate image sizes and formats
- **Caching**: Leverage browser caching where appropriate

---

## Project Context & Domain Knowledge

### Medical Internship System
- **Target Users**: Medical interns, supervisors, administrators
- **Primary Goals**: Learning management, progress tracking, assessment
- **Key Features**: Quizzes, case studies, reflective logs, quests, progress dashboard
- **Language**: Primarily Thai with English technical terms

### LIFF Integration
- **Platform**: LINE LIFF for mobile-first experience
- **Authentication**: LINE user profile integration
- **Notifications**: LINE chat integration for updates
- **Constraints**: Mobile viewport, LINE browser limitations

### Firebase Backend
- **Database**: Firestore with real-time listeners
- **Authentication**: Firebase Auth with LINE integration
- **Hosting**: Firebase Hosting with GitHub Pages deployment
- **Collections**: Structured for medical education workflow

---

**These guidelines are working if:** fewer unnecessary changes in diffs, fewer rewrites due to overcomplication, clarifying questions come before implementation rather than after mistakes, and all changes maintain the project's medical education integrity.
