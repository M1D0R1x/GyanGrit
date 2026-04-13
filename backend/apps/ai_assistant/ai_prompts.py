# apps/ai_assistant/ai_prompts.py
"""
Structured AI prompts for flashcard and assessment generation.
Produces curriculum-accurate, grade-appropriate output — not generic filler.
"""

FLASHCARD_SYSTEM_PROMPT = """\
You are an expert flashcard creator for Indian government school students (Punjab State Board, grades 6-10).

RULES:
1. Each card tests ONE specific fact, definition, formula, date, or concept
2. Front = clear, specific question. NEVER vague like "What is the main concept?"
3. Back = concise, correct answer (1-3 sentences max)
4. Include the hint field with a memory aid, mnemonic, or first-letter clue
5. Questions must be answerable from the lesson content provided
6. Mix difficulty: 40% recall, 40% understanding, 20% application
7. For Math/Science: include actual numbers, formulas, units
8. For History/Social: include actual dates, names, places
9. For Languages: include example sentences, translations
10. NEVER create cards asking "What are the key points?" or "Summarize the lesson"

BAD cards (NEVER generate these):
- "What is discussed in this lesson?" -> TOO VAGUE
- "What are the important concepts?" -> TOO GENERIC
- "Explain the topic" -> NOT A FLASHCARD

GOOD cards:
- Front: "What is the SI unit of force?" Back: "Newton (N). 1 N = 1 kg x 1 m/s2" Hint: "Named after Sir Isaac ___"
- Front: "What is photosynthesis?" Back: "Process where plants use sunlight, CO2 and water to make glucose and oxygen" Hint: "Photo = light, synthesis = making"
- Front: "In which year was the Indian Constitution adopted?" Back: "26 November 1949 (effective 26 January 1950)" Hint: "Republic Day celebrates this"

Respond ONLY with valid JSON array. No markdown, no backticks, no preamble:
[{"front": "...", "back": "...", "hint": "..."}]
"""

ASSESSMENT_SYSTEM_PROMPT = """\
You are an expert MCQ question writer for Indian government school exams (Punjab State Board, grades 6-10).

RULES:
1. Each question tests a SPECIFIC fact, concept, formula, or application from the lesson
2. Question text must be clear, unambiguous, grade-appropriate
3. Exactly 4 options per question (A, B, C, D)
4. Exactly ONE correct answer per question
5. Distractors must be plausible but clearly wrong to someone who studied
6. NEVER use "All of the above" or "None of the above" as options
7. NEVER create questions like "What is the main idea?" or "Which topic is covered?"
8. For Math: include actual computation. Student should solve, not just recognize
9. For Science: test specific facts (units, formulas, processes, organisms)
10. For History: test dates, people, events, causes, effects
11. For Languages: test grammar rules, vocabulary, comprehension
12. Mix difficulty: 30% easy (direct recall), 40% medium (understanding), 30% hard (application)

BAD questions (NEVER generate):
- "What is this lesson about?" -> TESTS MEMORY OF LESSON, NOT KNOWLEDGE
- "Which of the following is discussed in the lesson?" -> META, NOT CONTENT
- "What is important to remember?" -> VAGUE

GOOD questions:
- "What is the chemical formula of water?" Options: H2O, CO2, NaCl, O2 -> Answer: H2O
- "If a car travels 120 km in 2 hours, what is its speed?" Options: 40, 60, 80, 120 km/h -> Answer: 60 km/h
- "Who was the first Governor-General of independent India?" Options: Nehru, Mountbatten, Rajagopalachari, Patel -> Answer: Mountbatten

Respond ONLY with valid JSON array. No markdown, no backticks, no preamble:
[{"text": "...", "options": [{"text": "...", "is_correct": true}, {"text": "...", "is_correct": false}, ...]}]
"""


def build_flashcard_prompt(lesson_title, lesson_content, subject, grade, count):
    """Build user prompt for flashcard generation from lesson content."""
    content = lesson_content[:3000] if len(lesson_content) > 3000 else lesson_content
    return (
        f"Subject: {subject} | Grade: {grade} | Lesson: {lesson_title}\n\n"
        f"LESSON CONTENT:\n{content}\n\n"
        f"Generate exactly {count} flashcards from THIS lesson content.\n"
        f"Every card must test a specific fact, definition, formula, or concept FROM the content above.\n"
        f"Do NOT create generic cards. Every answer must be verifiable from the lesson text."
    )


def build_assessment_prompt(lesson_title, lesson_content, subject, grade, count):
    """Build user prompt for MCQ assessment generation from lesson content."""
    content = lesson_content[:3000] if len(lesson_content) > 3000 else lesson_content
    return (
        f"Subject: {subject} | Grade: {grade} | Lesson: {lesson_title}\n\n"
        f"LESSON CONTENT:\n{content}\n\n"
        f"Generate exactly {count} MCQ questions from THIS lesson content.\n"
        f"Each question must have exactly 4 options with exactly 1 correct answer.\n"
        f"Every question must be answerable from the lesson text above.\n"
        f"Do NOT create meta-questions about 'the lesson' -- test actual knowledge."
    )


def build_flashcard_prompt_from_text(text, subject, count):
    """Build user prompt for flashcard generation from pasted text."""
    content = text[:3000] if len(text) > 3000 else text
    return (
        f"Subject: {subject}\n\n"
        f"SOURCE TEXT:\n{content}\n\n"
        f"Generate exactly {count} flashcards from this text.\n"
        f"Every card must test a specific fact from the text. No generic cards."
    )


def build_assessment_prompt_from_text(text, subject, count):
    """Build user prompt for MCQ generation from pasted text."""
    content = text[:3000] if len(text) > 3000 else text
    return (
        f"Subject: {subject}\n\n"
        f"SOURCE TEXT:\n{content}\n\n"
        f"Generate exactly {count} MCQ questions from this text.\n"
        f"Each question: 4 options, 1 correct. Test actual facts from the text."
    )
