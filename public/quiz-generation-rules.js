// Shared by the real generation routes and the held-out evaluation.
window.QUIZ_GENERATION_RULES = `QUESTION QUALITY REQUIREMENTS:
- Each question must stand alone: include every source fact, number, unit and condition needed to answer it in its stem. The learner cannot see the source or explanation while answering.
- Use only facts supplied in the source. Do not invent product names/types, patient details, clinical findings or numerical inputs. Preserve required redaction placeholders.
- Do not hide necessary premises only in the explanation or refer to an unavailable passage.
- For single-answer MCQs, exactly one option must be defensible; check equivalent values and units across all options. Keep distractors distinct and plausible.
- If the source cannot support the requested number of distinct questions, return fewer supported questions rather than invent facts, preserving the requested JSON schema.`;
