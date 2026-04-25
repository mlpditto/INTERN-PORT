# Quick Reference: Karpathy Guidelines for INTERN-PORT

Quick reference for applying the guidelines in daily development.

---

## 🎯 4 Core Principles (At a Glance)

### 1. Think Before Coding
- ❌ Don't assume → ✅ Ask questions
- ❌ Hide confusion → ✅ Surface uncertainty
- ❌ Silent decisions → ✅ Present tradeoffs

### 2. Simplicity First  
- ❌ Over-engineer → ✅ Minimum viable solution
- ❌ Speculative features → ✅ Only what's requested
- ❌ Complex abstractions → ✅ Direct implementation

### 3. Surgical Changes
- ❌ Drive-by refactoring → ✅ Touch only what's needed
- ❌ Style improvements → ✅ Match existing patterns
- ❌ Delete old code → ✅ Only your own orphans

### 4. Goal-Driven Execution
- ❌ "Make it work" → ✅ Specific success criteria
- ❌ One-shot attempts → ✅ Verification loops
- ❌ Vague instructions → ✅ Clear testable outcomes

---

## 🔧 Common Task Templates

### Adding New Features
```
1. Clarify requirements → verify: understood
2. Plan implementation → verify: minimal approach
3. Update HTML → verify: responsive, semantic
4. Add CSS → verify: matches design system
5. Implement JS → verify: no errors, integrates
6. Test E2E → verify: feature works
7. Update version → verify: consistent
```

### Bug Fixes
```
1. Reproduce issue → verify: consistent
2. Identify root cause → verify: exact problem
3. Fix specifically → verify: issue resolved
4. Test edge cases → verify: robust
5. Regression test → verify: no new issues
```

### Firebase Changes
```
1. Define schema → verify: follows patterns
2. Implement reads → verify: handles errors
3. Implement writes → verify: validates
4. Test with data → verify: CRUD works
5. Security check → verify: rules intact
```

---

## 🚨 Critical Rules for INTERN-PORT

1. **NEVER** break LIFF authentication
2. **ALWAYS** test both user & admin interfaces
3. **MAINTAIN** backward compatibility
4. **USE** existing global variables
5. **FOLLOW** established UI patterns

---

## 📝 Quick Checklist Before Coding

### Requirements Check
- [ ] What exactly is needed?
- [ ] What are the edge cases?
- [ ] What should NOT be changed?
- [ ] Are there existing patterns to follow?

### Implementation Check
- [ ] Is this the simplest approach?
- [ ] Does this follow project patterns?
- [ ] Will this break existing functionality?
- [ ] Are the success criteria clear?

### Verification Check
- [ ] Does each step have verification?
- [ ] Are tests comprehensive?
- [ ] Is regression testing planned?
- [ ] Is deployment verification included?

---

## 🎯 Success Indicators

### Working Well
✅ Fewer code revisions  
✅ Clear requirements before coding  
✅ Minimal, focused changes  
✅ No broken existing functionality  
✅ Clear success criteria  

### Need Improvement
❌ Multiple revision cycles  
❌ Assumptions lead to rework  
❌ Overcomplicated solutions  
❌ Broken existing features  
❌ Vague requirements  

---

## 💡 Pro Tips

### Before Starting
- "Let me confirm the requirements..."
- "I see a few approaches, here are the tradeoffs..."
- "Should I handle this edge case?"

### During Implementation
- "This is the minimal change needed..."
- "I'm following the existing pattern for..."
- "Let me verify this step works before continuing..."

### Before Deployment
- "All verification steps completed..."
- "No regression in existing features..."
- "Ready for deployment testing..."

---

## 🔄 Verification Loop Examples

### Good: "Add user profile to Done cards"
```
1. Add completedBy field → verify: tasks track completer
2. Create profile fetch → verify: loads user data  
3. Add profile HTML → verify: displays in Done cards
4. Test with data → verify: profile pictures load
5. Update version → verify: consistent across files
```

### Bad: "Add user profile to Done cards"
```
1. Start coding profile system
2. Create complex caching
3. Refactor card system
4. Break other features
5. Multiple revisions needed
```

---

**Remember:** It's better to spend 5 minutes clarifying than 2 hours reworking!
