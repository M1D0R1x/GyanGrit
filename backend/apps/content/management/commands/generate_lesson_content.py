# backend/apps/content/management/commands/generate_lesson_content.py
"""
Generate real curriculum-aligned lesson content using AI.

Usage:
  python manage.py generate_lesson_content                    # dry-run all
  python manage.py generate_lesson_content --apply            # write all
  python manage.py generate_lesson_content --course 50 --apply  # one course
  python manage.py generate_lesson_content --force --apply    # overwrite existing content too
  python manage.py generate_lesson_content --min-chars 200 --apply  # only replace short content

Without --force: only fills lessons with content < --min-chars (default 200).
With --force: overwrites ALL lesson content.
"""
import logging
import time

from django.core.management.base import BaseCommand
from apps.content.models import Course, Lesson

logger = logging.getLogger(__name__)

# Punjab state board aligned curriculum topics per subject per grade.
# Used as context so AI generates real subject matter, not generic filler.
CURRICULUM_HINTS = {
    "Maths": {
        6: "Number system, whole numbers, integers, fractions, decimals, basic geometry, data handling, ratio and proportion, algebra introduction",
        7: "Integers, fractions and decimals, rational numbers, simple equations, lines and angles, triangles, congruence, data handling, perimeter and area",
        8: "Rational numbers, linear equations, quadrilaterals, data handling, squares and square roots, cubes and cube roots, algebraic expressions, factorisation",
        9: "Real numbers, polynomials, coordinate geometry, linear equations in two variables, Euclid's geometry, lines and angles, triangles, quadrilaterals, circles, surface areas and volumes, statistics, probability",
        10: "Real numbers, polynomials, pair of linear equations, quadratic equations, arithmetic progressions, triangles similarity, coordinate geometry, trigonometry, circles, surface areas and volumes, statistics, probability",
    },
    "Physics": {
        6: "Motion and measurement of distances, light shadows and reflections, electricity and circuits, magnets, fun with magnets",
        7: "Heat and temperature, motion and time, electric current and its effects, light, wind storms and cyclones",
        8: "Force and pressure, friction, sound, chemical effects of electric current, light reflection, stars and solar system",
        9: "Motion (distance, displacement, velocity, acceleration), force and laws of motion (Newton's laws), gravitation, work and energy, sound (wave properties, echo, resonance)",
        10: "Light (reflection, refraction, lenses, mirrors), human eye and colourful world, electricity (Ohm's law, circuits, power), magnetic effects of electric current, sources of energy",
    },
    "Chemistry": {
        6: "Sorting materials into groups, separation of substances, changes around us, water and its properties",
        7: "Acids bases and salts introduction, physical and chemical changes, fibre to fabric (natural and synthetic), soil",
        8: "Synthetic fibres and plastics, metals and non-metals, coal and petroleum, combustion and flame, pollution of air and water",
        9: "Matter in our surroundings (states of matter, change of state), is matter around us pure (mixtures, solutions, colloids), atoms and molecules, structure of atom (Thomson, Rutherford, Bohr models)",
        10: "Chemical reactions and equations (types, balancing), acids bases and salts (pH scale, indicators), metals and non-metals (reactivity series, extraction), carbon and its compounds (organic chemistry basics, homologous series), periodic classification of elements",
    },
    "Biology": {
        6: "Food: where does it come from, components of food, getting to know plants, body movements, living organisms and their surroundings, garbage in garbage out",
        7: "Nutrition in plants and animals, respiration in organisms, transportation in animals and plants, reproduction in plants, forests (our lifeline), wastewater story",
        8: "Crop production and management, microorganisms (friend and foe), conservation of plants and animals, cell structure and functions, reproduction in animals, reaching the age of adolescence",
        9: "The fundamental unit of life (cell), tissues (plant and animal), diversity in living organisms (classification), why do we fall ill (diseases and immunity), natural resources, improvement in food resources",
        10: "Life processes (nutrition, respiration, transport, excretion), control and coordination (nervous system, hormones), how do organisms reproduce, heredity and evolution, our environment (ecosystem, food chains), management of natural resources",
    },
    "English 1": {
        6: "Prose comprehension, poetry appreciation, grammar (tenses, nouns, pronouns, articles), letter writing, paragraph writing, vocabulary building",
        7: "Prose and poetry analysis, grammar (adjectives, adverbs, prepositions, conjunctions), essay writing, dialogue writing, comprehension passages",
        8: "Literature (prose, poetry, drama), grammar (active-passive voice, direct-indirect speech, clauses), report writing, notice writing, formal letters",
        9: "Beehive and Moments textbook prose and poetry, grammar transformation exercises, writing skills (article, story, letter, diary entry), reading comprehension, gap filling",
        10: "First Flight and Footprints textbook prose and poetry, grammar (tenses, modals, determiners, reported speech), letter writing, analytical paragraph, reading comprehension",
    },
    "English 2": {
        6: "Supplementary reader stories, oral communication, listening skills, picture description, role play activities, vocabulary enrichment through stories",
        7: "Supplementary reader, story retelling, speaking skills, group discussion, situational writing, translation exercises English-Punjabi",
        8: "Supplementary literature, debate and declamation, creative writing (short story, poem), book review, project-based language activities",
        9: "Moments supplementary reader, literature appreciation, extended reading, writing (review, speech, debate), advanced vocabulary and idioms",
        10: "Footprints supplementary reader, critical analysis of stories, advanced writing (report, feature article, review), literary devices, exam-oriented practice",
    },
    "Punjabi": {
        6: "Punjabi alphabet revision, grammar (noun, pronoun, verb basics), prose lessons from textbook, poetry recitation, essay writing, letter writing, Punjabi culture stories",
        7: "Grammar (tenses, gender, number), prose comprehension, poetry analysis, paragraph writing, Punjabi folk tales, vocabulary, dictation",
        8: "Advanced grammar (voice, speech), literature analysis, essay writing, formal and informal letters, Punjabi literary heritage, creative writing",
        9: "Prose and poetry from prescribed textbook, grammar (idioms, muhavare, phrases), essay and letter writing, comprehension, Punjabi literature introduction",
        10: "Literature from prescribed textbook, advanced grammar and composition, essay and letter writing, comprehension passages, Punjabi literary figures, translation",
    },
    "Hindi": {
        6: "Hindi grammar basics (sangya, sarvnam, kriya), prose lessons, poetry, letter writing, essay writing, paragraph writing, vocabulary",
        7: "Grammar (visheshan, kriya-visheshan, sambandh bodhak), prose and poetry, essay writing, informal letters, story writing, dialogue",
        8: "Vasant and Durva textbooks, grammar (vachya, kaal, sandhi), formal letters, essay writing, comprehension, creative writing",
        9: "Kshitij and Kritika prose and poetry, grammar (pad parichay, vakya, alankar), essay, letter, advertisement, notice writing",
        10: "Kshitij and Kritika textbooks, grammar (ras, chhand, alankar, muhavare), essay and letter writing, comprehension, literary analysis",
    },
    "Social 1": {
        6: "History: early humans, first farmers and herders, first cities (Harappa), early states, new ideas (Buddhism, Jainism), Ashoka, Gupta empire",
        7: "History: medieval India, Delhi Sultanate, Mughal empire, tribal societies, devotional paths in India, architecture and culture",
        8: "History: modern India, East India Company, British rule, revolt of 1857, education and social reform, national movement, making of Indian constitution",
        9: "History: French Revolution, socialism in Europe, Nazism and rise of Hitler, forest society and colonialism, pastoralists in the modern world",
        10: "History: rise of nationalism in India, nationalism in Europe, Indo-China and nationalism, age of industrialisation, print culture and modern world, globalization",
    },
    "Social 2": {
        6: "Geography: Earth in the solar system, globe (latitudes, longitudes), motions of earth, maps, major domains, major landforms, India climate vegetation wildlife. Civics: understanding diversity, government, local government, rural and urban livelihoods",
        7: "Geography: environment, atmosphere, water, natural vegetation and wildlife, human environment interactions. Civics: equality in Indian democracy, state government, growing up as boys and girls, role of media, markets",
        8: "Geography: resources (types and conservation), land soil water, agriculture, industries, human resources. Civics: Indian constitution, understanding secularism, parliament, judiciary, understanding marginalisation, confronting social justice",
        9: "Geography: India size and location, physical features, drainage, climate, natural vegetation and wildlife, population. Civics: what is democracy, constitutional design, electoral politics, working of institutions, democratic rights. Economics: story of village Palampur, people as resource, poverty as a challenge, food security in India",
        10: "Geography: resources and development, forest and wildlife, water resources, agriculture, minerals and energy, manufacturing, lifelines of national economy. Civics: power sharing, federalism, democracy and diversity, gender religion caste, political parties, outcomes of democracy. Economics: development, sectors of economy, money and credit, globalisation, consumer rights",
    },
    "GK": {
        6: "Current affairs India, famous personalities, Indian states and capitals, national symbols, basic science facts, sports and games, important dates and days",
        7: "World geography basics, Indian history milestones, inventions and discoveries, Indian constitution basics, environmental awareness, space exploration",
        8: "Indian economy basics, world organisations (UN, WHO, UNESCO), Indian defence, famous books and authors, awards and honours, science and technology updates",
        9: "Current affairs (national and international), Indian polity, Indian geography, basic economics, science and technology, environment and ecology, sports",
        10: "Comprehensive current affairs, Indian and world history, polity and governance, economy, science, geography, art and culture, sports, awards, books and authors",
    },
    "Computer Science": {
        6: "Introduction to computers (parts, types), input-output devices, computer memory, operating system basics, MS Paint, introduction to internet safety",
        7: "Computer software (system and application), MS Word basics (formatting, tables), introduction to internet and email, file management, basic HTML tags",
        8: "MS Word advanced, MS PowerPoint (presentations), introduction to spreadsheets (MS Excel), internet browsing and search, cyber safety, introduction to coding (Scratch)",
        9: "Computer networks and internet, HTML (tags, attributes, forms, tables), introduction to programming (Python basics: variables, data types, operators, input/output), cyber ethics, database concepts",
        10: "Python programming (loops, functions, lists, tuples, dictionaries, strings), relational database concepts, SQL basics (SELECT, INSERT, UPDATE, DELETE), cyber security, societal impacts of IT, practical applications",
    },
}


SYSTEM_PROMPT = """You are an expert curriculum writer for Indian government school students (Punjab state board, grades 6-10).

Write REAL educational lesson content — NOT generic filler. Include:

1. **Learning Objectives** (2-3 bullet points)
2. **Key Concepts** — detailed explanation with real examples relevant to Indian/Punjabi context
3. **Important Definitions** — bold key terms with clear definitions  
4. **Worked Examples** — at least 2 solved examples (for Math/Science) or detailed explanations (for other subjects)
5. **Did You Know?** — one interesting fact related to the topic
6. **Quick Recap** — 4-5 bullet point summary
7. **Practice Questions** — 3 questions (mix of easy, medium, hard)

Use markdown formatting. Write 400-600 words. Match the grade level vocabulary.
For Math: use LaTeX-style notation where needed.
For Science: include diagrams described in text form.
For languages: include example sentences and translations where relevant.
Make content specific to the ACTUAL TOPIC — not generic."""


def generate_content(subject: str, grade: int, title: str, order: int) -> str:
    """Try Groq -> Together -> Gemini. Return markdown."""
    # Get curriculum context for this subject+grade
    hints = CURRICULUM_HINTS.get(subject, {}).get(grade, "")
    
    prompt = (
        f"Subject: {subject}\n"
        f"Grade: {grade} (Punjab State Board)\n"
        f"Lesson {order}: {title}\n"
        f"Curriculum context for this grade: {hints}\n\n"
        f"Write the FULL lesson content for '{title}'. "
        f"Be specific to the actual topic. Include real facts, formulas, dates, or examples as appropriate."
    )

    for fn, name in [(_call_groq, "Groq"), (_call_together, "Together"), (_call_gemini, "Gemini")]:
        try:
            result = fn(prompt)
            if result and len(result) > 100:
                return result
        except Exception as e:
            logger.warning("%s failed: %s", name, e)

    return ""


def _call_groq(prompt: str) -> str:
    import os, requests
    key = os.environ.get("GROQ_API_KEY", "")
    if not key:
        raise ValueError("GROQ_API_KEY not set")
    resp = requests.post(
        "https://api.groq.com/openai/v1/chat/completions",
        headers={"Authorization": f"Bearer {key}", "Content-Type": "application/json"},
        json={
            "model": "llama-3.3-70b-versatile",
            "messages": [
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": prompt},
            ],
            "max_tokens": 2000,
            "temperature": 0.7,
        },
        timeout=45,
    )
    resp.raise_for_status()
    return resp.json()["choices"][0]["message"]["content"].strip()


def _call_together(prompt: str) -> str:
    import os, requests
    key = os.environ.get("TOGETHER_API_KEY", "")
    if not key:
        raise ValueError("TOGETHER_API_KEY not set")
    resp = requests.post(
        "https://api.together.xyz/v1/chat/completions",
        headers={"Authorization": f"Bearer {key}", "Content-Type": "application/json"},
        json={
            "model": "meta-llama/Llama-4-Maverick-17B-128E-Instruct-FP8",
            "messages": [
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": prompt},
            ],
            "max_tokens": 2000,
            "temperature": 0.7,
        },
        timeout=45,
    )
    resp.raise_for_status()
    return resp.json()["choices"][0]["message"]["content"].strip()


def _call_gemini(prompt: str) -> str:
    import os, requests
    key = os.environ.get("GEMINI_API_KEY", "")
    if not key:
        raise ValueError("GEMINI_API_KEY not set")
    resp = requests.post(
        f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key={key}",
        headers={"Content-Type": "application/json"},
        json={
            "contents": [{"parts": [{"text": f"{SYSTEM_PROMPT}\n\n{prompt}"}]}],
            "generationConfig": {"maxOutputTokens": 2000, "temperature": 0.7},
        },
        timeout=45,
    )
    resp.raise_for_status()
    return resp.json()["candidates"][0]["content"]["parts"][0]["text"].strip()


class Command(BaseCommand):
    help = "Generate real curriculum-aligned lesson content using AI"

    def add_arguments(self, parser):
        parser.add_argument("--apply", action="store_true", help="Write to DB (default: dry-run)")
        parser.add_argument("--force", action="store_true", help="Overwrite ALL content (not just short/empty)")
        parser.add_argument("--course", type=int, help="Only process this course ID")
        parser.add_argument("--min-chars", type=int, default=200, help="Replace content shorter than this (default: 200)")
        parser.add_argument("--delay", type=float, default=2.5, help="Seconds between API calls")

    def handle(self, *args, **options):
        apply = options["apply"]
        force = options["force"]
        course_filter = options["course"]
        min_chars = options["min_chars"]
        delay = options["delay"]

        qs = Lesson.objects.select_related("course__subject").filter(
            is_published=True
        ).order_by("course__grade", "course__subject__name", "order")

        if course_filter:
            qs = qs.filter(course_id=course_filter)

        if force:
            targets = list(qs)
            self.stdout.write(f"FORCE mode: will regenerate ALL {len(targets)} lessons.\n")
        else:
            targets = [l for l in qs if not l.content or len(l.content.strip()) < min_chars]
            self.stdout.write(f"Found {len(targets)} lessons with content < {min_chars} chars (out of {qs.count()} total).\n")

        if not targets:
            self.stdout.write(self.style.SUCCESS("Nothing to do."))
            return

        generated = 0
        failed = 0
        current_course = None

        for lesson in targets:
            # Print course header when it changes
            if lesson.course_id != current_course:
                current_course = lesson.course_id
                self.stdout.write(f"\n  Grade {lesson.course.grade} — {lesson.course.subject.name} — {lesson.course.title}")

            self.stdout.write(f"    L{lesson.order}: {lesson.title} ({len(lesson.content or '')} chars)... ", ending="")

            if not apply:
                self.stdout.write(self.style.WARNING("SKIP (dry-run)"))
                continue

            content = generate_content(
                lesson.course.subject.name,
                lesson.course.grade,
                lesson.title,
                lesson.order,
            )

            if content and len(content) > 100:
                lesson.content = content
                lesson.save(update_fields=["content"])
                generated += 1
                self.stdout.write(self.style.SUCCESS(f"OK ({len(content)} chars)"))
            else:
                failed += 1
                self.stdout.write(self.style.ERROR("FAILED"))

            time.sleep(delay)

        self.stdout.write(f"\nDone. Generated: {generated}, Failed: {failed}, Total: {len(targets)}")
        if not apply:
            self.stdout.write(self.style.WARNING("\nDry-run. Use --apply to write. Use --force --apply to overwrite all."))
