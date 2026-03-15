"""
management command: seed_content

Creates one Course per Subject × Grade (6–10),
5 NCERT-aligned Lessons per course, and 1 Assessment with 5 questions per course.

Lesson titles are specific to subject AND grade — not generic placeholders.
Based on the actual NCERT syllabus followed by Punjab government schools.

Run once after seed_punjab:

    python manage.py seed_content

Safe to re-run: uses get_or_create throughout.
"""
from django.core.management.base import BaseCommand
from django.db import transaction

from apps.academics.models import Subject
from apps.content.models import Course, Lesson
from apps.assessments.models import Assessment, Question, QuestionOption

GRADES = [6, 7, 8, 9, 10]

# ─────────────────────────────────────────────────────────────────────────────
# NCERT-aligned lesson titles: (subject_name, grade) → [5 lesson titles]
# ─────────────────────────────────────────────────────────────────────────────

LESSON_TEMPLATES = {

    # ── MATHEMATICS ──────────────────────────────────────────────────────────
    ("Mathematics", 6): [
        "Knowing Our Numbers — Place Value and Large Numbers",
        "Whole Numbers — Properties and Number Line",
        "Playing with Numbers — Factors, Multiples and Divisibility",
        "Basic Geometrical Ideas — Points, Lines and Angles",
        "Fractions — Representation and Comparison",
    ],
    ("Mathematics", 7): [
        "Integers — Operations and Properties on the Number Line",
        "Fractions and Decimals — Multiplication and Division",
        "Simple Equations — Forming and Solving",
        "Lines and Angles — Complementary, Supplementary and Parallel",
        "Ratio and Proportion — Unitary Method",
    ],
    ("Mathematics", 8): [
        "Rational Numbers — Properties and Representation",
        "Linear Equations in One Variable — Word Problems",
        "Understanding Quadrilaterals — Properties and Types",
        "Squares and Square Roots — Methods of Finding",
        "Comparing Quantities — Percentages, Profit-Loss and Simple Interest",
    ],
    ("Mathematics", 9): [
        "Number Systems — Real Numbers, Irrational Numbers and Surds",
        "Polynomials — Zeros, Factorisation and Remainder Theorem",
        "Coordinate Geometry — Cartesian Plane and Plotting Points",
        "Lines and Angles — Theorems and Proofs",
        "Triangles — Congruence Rules and Inequalities",
    ],
    ("Mathematics", 10): [
        "Real Numbers — Euclid's Division Lemma and Fundamental Theorem",
        "Polynomials — Relationship between Zeros and Coefficients",
        "Pair of Linear Equations — Graphical and Algebraic Methods",
        "Quadratic Equations — Factorisation and Quadratic Formula",
        "Introduction to Trigonometry — Ratios, Identities and Applications",
    ],

    # ── PHYSICS ──────────────────────────────────────────────────────────────
    ("Physics", 6): [
        "Food: Where Does It Come From? — Sources and Ingredients",
        "Sorting Materials into Groups — Properties of Materials",
        "Motion and Measurement of Distances — Standard Units",
        "Light, Shadows and Reflections — Transparent and Opaque Objects",
        "Electricity and Circuits — Components and Simple Circuits",
    ],
    ("Physics", 7): [
        "Heat — Temperature, Conduction, Convection and Radiation",
        "Motion and Time — Speed, Distance-Time Graphs",
        "Electric Current and Its Effects — Heating and Magnetic Effects",
        "Light — Reflection and Plane Mirrors",
        "Wind, Storms and Cyclones — Air Pressure and Weather",
    ],
    ("Physics", 8): [
        "Force and Pressure — Types of Forces and Pascal's Law",
        "Friction — Factors Affecting and Methods of Reducing",
        "Sound — Vibration, Propagation and Human Ear",
        "Chemical Effects of Electric Current — Electrolysis",
        "Stars and the Solar System — Planets, Moon and Constellations",
    ],
    ("Physics", 9): [
        "Motion — Distance, Displacement, Speed, Velocity and Acceleration",
        "Laws of Motion — Newton's Three Laws and Applications",
        "Gravitation — Universal Law, Free Fall and Weight",
        "Work, Energy and Power — Kinetic and Potential Energy",
        "Sound — Wave Motion, Reflection and Applications",
    ],
    ("Physics", 10): [
        "Light — Reflection and Refraction at Curved Surfaces",
        "Human Eye and the Colourful World — Defects and Dispersion",
        "Electricity — Ohm's Law, Resistance and Power",
        "Magnetic Effects of Electric Current — Electromagnets and Motors",
        "Sources of Energy — Renewable and Non-Renewable Sources",
    ],

    # ── CHEMISTRY ────────────────────────────────────────────────────────────
    ("Chemistry", 6): [
        "Fibre to Fabric — Natural Fibres: Cotton and Jute",
        "Separation of Substances — Methods and Their Uses",
        "Changes Around Us — Reversible and Irreversible Changes",
        "Getting to Know Plants — Parts and Their Functions",
        "Water — Sources, Uses and Conservation",
    ],
    ("Chemistry", 7): [
        "Acids, Bases and Salts — Properties and Indicators",
        "Physical and Chemical Changes — Differences and Examples",
        "Weather, Climate and Adaptations — Effect on Living Things",
        "Fibre to Fabric — Wool and Silk Production",
        "Forests — Products, Importance and Conservation",
    ],
    ("Chemistry", 8): [
        "Synthetic Fibres and Plastics — Types and Properties",
        "Materials — Metals and Non-Metals",
        "Coal and Petroleum — Formation and Uses",
        "Combustion and Flame — Types of Combustion and Calorific Value",
        "Pollution of Air and Water — Causes and Control",
    ],
    ("Chemistry", 9): [
        "Matter in Our Surroundings — States and Properties",
        "Is Matter Around Us Pure? — Mixtures and Solutions",
        "Atoms and Molecules — Atomic Mass, Mole Concept",
        "Structure of the Atom — Thomson, Rutherford and Bohr Models",
        "The Fundamental Unit of Life — Cell Structure and Organelles",
    ],
    ("Chemistry", 10): [
        "Chemical Reactions and Equations — Types and Balancing",
        "Acids, Bases and Salts — pH Scale and Everyday Applications",
        "Metals and Non-metals — Properties and Reactivity Series",
        "Carbon and Its Compounds — Covalent Bonding and Functional Groups",
        "Periodic Classification of Elements — Mendeleev and Modern Table",
    ],

    # ── BIOLOGY ──────────────────────────────────────────────────────────────
    ("Biology", 6): [
        "The Living World — Characteristics of Living Organisms",
        "Components of Food — Nutrients, Deficiency and Balanced Diet",
        "Body Movements — Joints, Bones and Muscles",
        "The Living Organisms and Their Surroundings — Habitat and Adaptation",
        "Garbage In, Garbage Out — Waste Management and Composting",
    ],
    ("Biology", 7): [
        "Nutrition in Plants — Photosynthesis and Modes of Nutrition",
        "Nutrition in Animals — Digestive System and Amoeba",
        "Transportation in Plants and Animals — Circulatory System",
        "Reproduction in Plants — Vegetative and Sexual Reproduction",
        "Respiration in Organisms — Aerobic and Anaerobic Respiration",
    ],
    ("Biology", 8): [
        "Crop Production and Management — Agricultural Practices",
        "Microorganisms — Types, Uses and Harmful Effects",
        "Conservation of Plants and Animals — Biodiversity and Wildlife",
        "Cell — Structure and Functions of Organelles",
        "Reproduction in Animals — Sexual and Asexual Reproduction",
    ],
    ("Biology", 9): [
        "The Fundamental Unit of Life — Cell Theory and Organelles",
        "Tissues — Plant Tissues and Animal Tissues",
        "Diversity in Living Organisms — Five Kingdom Classification",
        "Why Do We Fall Ill? — Disease, Immunity and Prevention",
        "Natural Resources — Air, Water, Soil and Biogeochemical Cycles",
    ],
    ("Biology", 10): [
        "Life Processes — Nutrition, Respiration, Transport and Excretion",
        "Control and Coordination — Nervous System and Hormones",
        "How Do Organisms Reproduce? — Asexual and Sexual Reproduction",
        "Heredity and Evolution — Mendel's Laws and Natural Selection",
        "Our Environment — Ecosystem, Food Chains and Waste Management",
    ],

    # ── ENGLISH 1 ─────────────────────────────────────────────────────────────
    ("English 1", 6): [
        "Who Did Patrick's Homework? — Reading and Comprehension",
        "How the Dog Found Himself a Master — Story Analysis",
        "Taro's Reward — Moral Values and Vocabulary",
        "A Different Kind of School — Descriptive Writing",
        "Grammar — Nouns, Pronouns and Subject-Verb Agreement",
    ],
    ("English 1", 7): [
        "Three Questions — Leo Tolstoy: Theme and Comprehension",
        "A Gift of Chappals — Character Sketch Writing",
        "Gopal and the Hilsa Fish — Inference and Tone",
        "The Ashes That Made Trees Bloom — Moral and Vocabulary",
        "Grammar — Tenses: Simple, Continuous and Perfect",
    ],
    ("English 1", 8): [
        "The Best Christmas Present in the World — Letter Writing",
        "The Tsunami — Factual Writing and Cause-Effect",
        "Glimpses of the Past — Historical Comprehension",
        "Bepin Choudhury's Lapse of Memory — Character Analysis",
        "Grammar — Passive Voice and Reported Speech",
    ],
    ("English 1", 9): [
        "The Fun They Had — Isaac Asimov: Theme and Inference",
        "The Sound of Music — Biography Writing",
        "The Little Girl — Characterisation and Emotion",
        "A Truly Beautiful Mind — Einstein: Comprehension",
        "Grammar — Modals, Determiners and Clauses",
    ],
    ("English 1", 10): [
        "A Letter to God — Faith and Irony in Literature",
        "Nelson Mandela — Long Walk to Freedom: Summary",
        "Two Stories About Flying — Courage and Determination",
        "From the Diary of Anne Frank — Diary Writing",
        "Grammar — Subject-Verb Agreement, Tenses and Editing",
    ],

    # ── ENGLISH 2 ─────────────────────────────────────────────────────────────
    ("English 2", 6): [
        "A House, A Home — Poem: Rhyme Scheme and Theme",
        "The Kite — Poem: Imagery and Figure of Speech",
        "Unseen Passage Practice — Skimming and Scanning",
        "Formal Letter Writing — Format and Language",
        "Vocabulary Building — Synonyms, Antonyms and Word Families",
    ],
    ("English 2", 7): [
        "The Squirrel — Poem: Nature Imagery",
        "Dad and the Cat and the Tree — Humour in Poetry",
        "Unseen Passage — Inferential Questions",
        "Informal Letter Writing — Tone and Structure",
        "Grammar in Context — Adjectives and Adverbs",
    ],
    ("English 2", 8): [
        "The Ant and the Cricket — Fable and Moral",
        "Geography Lesson — Poem: Perspective and Irony",
        "Unseen Passage — Multiple Choice and Short Answer",
        "Notice and Message Writing — Format and Brevity",
        "Grammar — Conjunctions, Prepositions and Interjections",
    ],
    ("English 2", 9): [
        "The Road Not Taken — Robert Frost: Theme and Symbolism",
        "Wind — Subramania Bharati: Personification",
        "Unseen Passage — Comprehension and Vocabulary",
        "Formal Essay Writing — Introduction, Body and Conclusion",
        "Grammar — Phrases, Clauses and Sentence Transformation",
    ],
    ("English 2", 10): [
        "Dust of Snow — Robert Frost: Imagery and Mood",
        "Fire and Ice — Symbolism and Poetic Devices",
        "Unseen Passage — Factual and Literary",
        "Article and Speech Writing — Format and Persuasion",
        "Grammar — Gap Filling, Editing and Omission",
    ],

    # ── PUNJABI ───────────────────────────────────────────────────────────────
    ("Punjabi", 6): [
        "ਮੇਰਾ ਪੰਜਾਬ — ਪਾਠ ਪੜ੍ਹਨਾ ਅਤੇ ਅਰਥ ਸਮਝਣਾ",
        "ਵਰਣਮਾਲਾ ਅਤੇ ਮਾਤਰਾਵਾਂ — ਸੁਆਰ ਅਤੇ ਵਿਅੰਜਨ",
        "ਨਾਂਵ ਅਤੇ ਪੜਨਾਂਵ — ਪਰਿਭਾਸ਼ਾ ਅਤੇ ਉਦਾਹਰਣ",
        "ਚਿੱਠੀ ਲਿਖਣਾ — ਰਸਮੀ ਅਤੇ ਗੈਰ-ਰਸਮੀ",
        "ਕਵਿਤਾ — ਪੰਜਾਬ ਦੀ ਧਰਤੀ: ਭਾਵ ਅਤੇ ਸੁੰਦਰਤਾ",
    ],
    ("Punjabi", 7): [
        "ਗੁਰੂ ਨਾਨਕ ਦੇਵ ਜੀ — ਜੀਵਨ ਅਤੇ ਸਿੱਖਿਆਵਾਂ",
        "ਵਿਸ਼ੇਸ਼ਣ ਅਤੇ ਕਿਰਿਆ — ਵਰਤੋਂ ਅਤੇ ਅਭਿਆਸ",
        "ਕਹਾਣੀ — ਮਿਹਨਤ ਦਾ ਫਲ: ਸਾਰ ਅਤੇ ਸਿੱਖਿਆ",
        "ਪੈਰਾ ਲਿਖਣਾ — ਵਿਸ਼ੇ ਦੀ ਚੋਣ ਅਤੇ ਵਿਸਥਾਰ",
        "ਲੋਕ ਗੀਤ ਅਤੇ ਬੋਲੀਆਂ — ਪੰਜਾਬੀ ਸੱਭਿਆਚਾਰ",
    ],
    ("Punjabi", 8): [
        "ਭਗਤ ਸਿੰਘ — ਜੀਵਨੀ ਅਤੇ ਕੁਰਬਾਨੀ",
        "ਵਾਕ ਦੀਆਂ ਕਿਸਮਾਂ — ਸਧਾਰਨ, ਸੰਯੁਕਤ ਅਤੇ ਮਿਸ਼ਰਤ",
        "ਲੇਖ ਲਿਖਣਾ — ਮੇਰਾ ਪਿੰਡ ਅਤੇ ਮੇਰਾ ਸ਼ਹਿਰ",
        "ਕਵਿਤਾ — ਵਾਰਿਸ ਸ਼ਾਹ ਅਤੇ ਹੀਰ: ਭਾਵ ਵਿਚਾਰ",
        "ਮੁਹਾਵਰੇ ਅਤੇ ਅਖਾਣ — ਅਰਥ ਅਤੇ ਵਰਤੋਂ",
    ],
    ("Punjabi", 9): [
        "ਪੰਜਾਬੀ ਸਾਹਿਤ ਦਾ ਇਤਿਹਾਸ — ਮੱਧਕਾਲੀ ਸਾਹਿਤ",
        "ਸੰਧਿ ਅਤੇ ਸਮਾਸ — ਪਰਿਭਾਸ਼ਾ ਅਤੇ ਕਿਸਮਾਂ",
        "ਇਕਾਂਗੀ — ਰੰਗਮੰਚ ਅਤੇ ਅਦਾਕਾਰੀ ਦੀ ਕਲਾ",
        "ਰਸਮੀ ਪੱਤਰ — ਅਰਜ਼ੀ ਅਤੇ ਸ਼ਿਕਾਇਤ ਪੱਤਰ",
        "ਕਾਵਿ ਰੂਪ — ਗ਼ਜ਼ਲ, ਕਾਫ਼ੀ ਅਤੇ ਢੋਲਾ",
    ],
    ("Punjabi", 10): [
        "ਆਧੁਨਿਕ ਪੰਜਾਬੀ ਕਵਿਤਾ — ਪ੍ਰਮੁੱਖ ਕਵੀ ਅਤੇ ਰਚਨਾਵਾਂ",
        "ਨਿਬੰਧ — ਵਾਤਾਵਰਣ ਪ੍ਰਦੂਸ਼ਣ ਅਤੇ ਸਾਡੀ ਜ਼ਿੰਮੇਵਾਰੀ",
        "ਵਿਆਕਰਣ — ਕਾਲ, ਵਚਨ ਅਤੇ ਲਿੰਗ ਦੀ ਵਰਤੋਂ",
        "ਨਾਵਲ ਅੰਸ਼ — ਨਾਨਕ ਸਿੰਘ ਅਤੇ ਪੰਜਾਬੀ ਗਲਪ",
        "ਅਪਠਿਤ ਗਦਯਾਂਸ਼ — ਬੋਧ ਅਤੇ ਸਿੱਟੇ ਕੱਢਣਾ",
    ],

    # ── HINDI ─────────────────────────────────────────────────────────────────
    ("Hindi", 6): [
        "वह चिड़िया जो — कविता: भाव और अर्थग्रहण",
        "बचपन — संस्मरण: मुख्य विचार और शब्द भंडार",
        "नादान दोस्त — कहानी: पात्र और घटनाक्रम",
        "संज्ञा और सर्वनाम — परिभाषा, भेद और उदाहरण",
        "पत्र लेखन — अनौपचारिक पत्र का प्रारूप",
    ],
    ("Hindi", 7): [
        "हम पंछी उन्मुक्त गगन के — कविता और काव्य-सौन्दर्य",
        "दादी माँ — पाठ-बोध और चरित्र-चित्रण",
        "क्रिया और काल — सामान्य, अपूर्ण और पूर्ण काल",
        "विशेषण — भेद, तुलना और प्रयोग",
        "निबंध लेखन — मेरा प्रिय त्योहार",
    ],
    ("Hindi", 8): [
        "ध्वनि — कविता: अलंकार और छन्द",
        "लाख की चूड़ियाँ — लोककला और मूल्यबोध",
        "बस की यात्रा — व्यंग्य: हास्य और भाषा-शैली",
        "वाक्य-भेद — सरल, संयुक्त और मिश्र वाक्य",
        "औपचारिक पत्र — आवेदन और शिकायत",
    ],
    ("Hindi", 9): [
        "दो बैलों की कथा — प्रेमचन्द: कथा-सार",
        "ल्हासा की ओर — यात्रा-वृत्तान्त",
        "उपसर्ग और प्रत्यय — शब्द-निर्माण",
        "समास — परिभाषा, भेद और विग्रह",
        "अपठित गद्यांश — बोध-प्रश्न और शीर्षक",
    ],
    ("Hindi", 10): [
        "सूरदास के पद — भक्तिकाल और ब्रजभाषा",
        "राम-लक्ष्मण-परशुराम संवाद — तुलसीदास",
        "नेताजी का चश्मा — देशभक्ति और व्यंग्य",
        "संधि और समास — उन्नत अभ्यास",
        "लेखन — विज्ञापन, संदेश और अनुच्छेद",
    ],

    # ── SOCIAL 1 (History / Civics) ───────────────────────────────────────────
    ("Social 1", 6): [
        "What, Where, How and When? — Sources of History",
        "On the Trail of the Earliest People — Hunter-Gatherers",
        "From Gathering to Growing Food — Neolithic Revolution",
        "In the Earliest Cities — Harappan Civilisation",
        "What Books and Burials Tell Us — Vedic Period",
    ],
    ("Social 1", 7): [
        "Tracing Changes Through a Thousand Years — Medieval India",
        "New Kings and Kingdoms — Rajputs and Regional Powers",
        "The Delhi Sultans — Slave, Khilji and Tughlaq Dynasties",
        "The Mughal Empire — Administration and Culture",
        "Rulers and Buildings — Architecture as History",
    ],
    ("Social 1", 8): [
        "How, When and Where — British Rule and Colonialism",
        "From Trade to Territory — The East India Company",
        "Ruling the Countryside — Land Revenue and Peasants",
        "Tribals, Dikus and the Vision of a Golden Age",
        "When People Rebel — 1857 and Its Aftermath",
    ],
    ("Social 1", 9): [
        "The French Revolution — Causes, Events and Impact",
        "Socialism in Europe and the Russian Revolution",
        "Nazism and the Rise of Hitler",
        "Forest Society and Colonialism — Deforestation",
        "Pastoralists in the Modern World — Nomadic Communities",
    ],
    ("Social 1", 10): [
        "The Rise of Nationalism in Europe — Romanticism and Unification",
        "Nationalism in India — Non-Cooperation Movement",
        "The Making of a Global World — Trade and Migration",
        "The Age of Industrialisation — Factories and Workers",
        "Print Culture and the Modern World — Press and Reform",
    ],

    # ── SOCIAL 2 (Geography / Economics) ─────────────────────────────────────
    ("Social 2", 6): [
        "The Earth in the Solar System — Planets, Moon and Stars",
        "Globe: Latitudes and Longitudes — Grid System",
        "Motions of the Earth — Rotation, Revolution and Seasons",
        "Maps — Physical, Political and Thematic Maps",
        "Major Domains of the Earth — Lithosphere, Hydrosphere, Atmosphere",
    ],
    ("Social 2", 7): [
        "Environment — Natural and Human-Made Components",
        "Our Changing Earth — Lithospheric Plates and Landforms",
        "Air — Composition, Structure and Weather",
        "Water — Distribution, Ocean Circulation and Water Cycle",
        "Human Environment Interactions — Tropical Rainforest",
    ],
    ("Social 2", 8): [
        "Resources — Types, Distribution and Conservation",
        "Land, Soil, Water, Natural Vegetation and Wildlife",
        "Agriculture — Types, Cropping Patterns in India",
        "Industries — Classification and Factors of Location",
        "Human Resources — Population Distribution and Migration",
    ],
    ("Social 2", 9): [
        "India — Size, Location and Physical Features",
        "Drainage — River Systems of India",
        "Climate — Factors, Monsoon and Seasons in India",
        "Natural Vegetation and Wildlife — Biomes of India",
        "Population — Growth, Distribution and Characteristics",
    ],
    ("Social 2", 10): [
        "Resources and Development — Types and Planning",
        "Forest and Wildlife Resources — Conservation",
        "Water Resources — Multipurpose Projects and Conservation",
        "Agriculture — Food Security and Land Use Pattern",
        "Minerals and Energy Resources — Distribution and Uses",
    ],

    # ── GK ────────────────────────────────────────────────────────────────────
    ("GK", 6): [
        "India — States, Capitals and Union Territories",
        "National Symbols — Flag, Emblem, Anthem and Animal",
        "Famous Personalities — Freedom Fighters of India",
        "Science in Daily Life — Simple Inventions and Uses",
        "Sports and Games — Olympics and National Sports",
    ],
    ("GK", 7): [
        "World Geography — Continents, Oceans and Countries",
        "Indian Constitution — Fundamental Rights and Duties",
        "Important Days and Events — National and International",
        "Inventions and Discoveries — Scientists and Their Contributions",
        "Punjab — History, Culture and Famous People",
    ],
    ("GK", 8): [
        "Government and Democracy — Parliament and Elections",
        "India and the World — International Organisations",
        "Environment and Ecology — Climate Change Basics",
        "Books and Authors — Famous Indian Literature",
        "Awards and Honours — Bharat Ratna, Nobel Prize",
    ],
    ("GK", 9): [
        "Indian Economy — Agriculture, Industry and Services",
        "Space Exploration — ISRO and India's Achievements",
        "World History — Key Events of the 20th Century",
        "Digital India — Technology and Everyday Life",
        "Health and Nutrition — WHO Guidelines and Diseases",
    ],
    ("GK", 10): [
        "Current Affairs — National and Global Events",
        "Science and Technology — Recent Innovations",
        "Environment — Sustainable Development Goals",
        "Indian Defence — Army, Navy and Air Force",
        "Competitive Exam Preparation — Reasoning and Aptitude Basics",
    ],

    # ── COMPUTER SCIENCE ──────────────────────────────────────────────────────
    ("Computer Science", 6): [
        "Introduction to Computers — History, Types and Uses",
        "Parts of a Computer — Hardware: CPU, RAM, Storage",
        "Input and Output Devices — Keyboard, Mouse, Monitor, Printer",
        "Introduction to Windows — Desktop, Files and Folders",
        "Microsoft Paint — Creating and Saving Drawings",
    ],
    ("Computer Science", 7): [
        "Storage Devices — Primary and Secondary Memory",
        "Microsoft Word — Formatting Text and Documents",
        "Microsoft Excel — Creating Simple Spreadsheets",
        "Internet Basics — Browser, URL and Search Engines",
        "Email — Creating, Sending and Receiving Emails",
    ],
    ("Computer Science", 8): [
        "Operating Systems — Functions and Types (Windows, Linux)",
        "Microsoft PowerPoint — Creating Presentations",
        "HTML Basics — Structure of a Web Page",
        "Cybersafety — Passwords, Privacy and Online Threats",
        "Introduction to Programming — Algorithms and Flowcharts",
    ],
    ("Computer Science", 9): [
        "Networking Concepts — LAN, WAN and Internet Protocols",
        "Database Basics — Tables, Queries and Records",
        "Introduction to Python — Variables, Data Types and I/O",
        "Conditional Statements in Python — if, elif and else",
        "Loops in Python — for Loop and while Loop",
    ],
    ("Computer Science", 10): [
        "Advanced Python — Functions, Lists and Dictionaries",
        "File Handling in Python — Reading and Writing Files",
        "Web Development Basics — HTML, CSS and Structure",
        "Artificial Intelligence — Machine Learning Concepts",
        "Cybersecurity — Ethical Hacking and Data Protection",
    ],
}

# ─────────────────────────────────────────────────────────────────────────────
# Generic fallback — if a subject name in DB doesn't match any key above
# ─────────────────────────────────────────────────────────────────────────────

DEFAULT_LESSONS = [
    "Introduction to the Chapter",
    "Core Concepts and Definitions",
    "Worked Examples and Problems",
    "Practice and Application",
    "Summary and Revision",
]

# ─────────────────────────────────────────────────────────────────────────────
# Sample MCQ questions — generic, works for any subject
# ─────────────────────────────────────────────────────────────────────────────

SAMPLE_QUESTIONS = [
    {
        "text": "Which of the following best describes the main concept of this lesson?",
        "options": [
            {"text": "The first and most common misconception", "is_correct": False},
            {"text": "The correct foundational definition", "is_correct": True},
            {"text": "An unrelated concept from another field", "is_correct": False},
            {"text": "A partially correct but incomplete answer", "is_correct": False},
        ],
    },
    {
        "text": "What is the correct sequence of steps in the process described?",
        "options": [
            {"text": "Step 2 → Step 1 → Step 3 → Step 4", "is_correct": False},
            {"text": "Step 1 → Step 3 → Step 2 → Step 4", "is_correct": False},
            {"text": "Step 1 → Step 2 → Step 3 → Step 4", "is_correct": True},
            {"text": "Step 4 → Step 3 → Step 2 → Step 1", "is_correct": False},
        ],
    },
    {
        "text": "Which statement about the key principle is TRUE?",
        "options": [
            {"text": "It applies only in specific laboratory conditions", "is_correct": False},
            {"text": "It was disproved in recent studies", "is_correct": False},
            {"text": "It forms the foundation of this entire chapter", "is_correct": True},
            {"text": "It is an optional concept for advanced students only", "is_correct": False},
        ],
    },
    {
        "text": "What is the primary purpose of the example discussed in this chapter?",
        "options": [
            {"text": "To introduce a new, unrelated concept", "is_correct": False},
            {"text": "To illustrate and reinforce the main learning objective", "is_correct": True},
            {"text": "To provide historical background only", "is_correct": False},
            {"text": "To contradict the earlier theory", "is_correct": False},
        ],
    },
    {
        "text": "Which of the following is NOT a characteristic of the topic studied?",
        "options": [
            {"text": "It follows a predictable pattern", "is_correct": False},
            {"text": "It can be observed and measured", "is_correct": False},
            {"text": "It exists independently without any context", "is_correct": True},
            {"text": "It has practical real-world applications", "is_correct": False},
        ],
    },
]


class Command(BaseCommand):
    help = (
        "Seed shared curriculum: one Course per Subject × Grade (6–10), "
        "5 NCERT-aligned Lessons per course, 1 Assessment with 5 questions."
    )

    @transaction.atomic
    def handle(self, *args, **kwargs):
        self.stdout.write("Seeding NCERT-aligned curriculum content...")

        subjects = list(Subject.objects.all())
        if not subjects:
            self.stdout.write(self.style.ERROR(
                "No subjects found. Run seed_punjab first."
            ))
            return

        courses_created = 0
        lessons_created = 0
        assessments_created = 0
        questions_created = 0
        fallback_used = []

        for subject in subjects:
            for grade in GRADES:
                lesson_titles = LESSON_TEMPLATES.get(
                    (subject.name, grade),
                    None,
                )
                if lesson_titles is None:
                    fallback_used.append(f"{subject.name} Class {grade}")
                    lesson_titles = DEFAULT_LESSONS

                course, course_created = Course.objects.get_or_create(
                    subject=subject,
                    grade=grade,
                    defaults={
                        "title": f"{subject.name} — Class {grade}",
                        "description": (
                            f"NCERT-aligned {subject.name} curriculum "
                            f"for Class {grade} students across Punjab."
                        ),
                        "is_core": True,
                    },
                )
                if course_created:
                    courses_created += 1

                for i, lesson_title in enumerate(lesson_titles, start=1):
                    _, lesson_created = Lesson.objects.get_or_create(
                        course=course,
                        order=i,
                        defaults={
                            "title": lesson_title,
                            "content": (
                                f"# {lesson_title}\n\n"
                                f"This lesson covers **{lesson_title}** "
                                f"as part of the {subject.name} Class {grade} curriculum.\n\n"
                                f"## Learning Objectives\n\n"
                                f"By the end of this lesson, students will be able to:\n"
                                f"- Understand the core concepts of this topic\n"
                                f"- Apply the principles to solve problems\n"
                                f"- Connect this topic to real-world scenarios\n\n"
                                f"## Content\n\n"
                                f"*Full lesson content will be added by the administrator "
                                f"using the Lesson Editor.*\n\n"
                                f"## Key Points\n\n"
                                f"1. First key point for this topic\n"
                                f"2. Second key point\n"
                                f"3. Third key point\n\n"
                                f"## Summary\n\n"
                                f"Review these key concepts before attempting the assessment."
                            ),
                            "is_published": True,
                        },
                    )
                    if lesson_created:
                        lessons_created += 1

                assessment, assessment_created = Assessment.objects.get_or_create(
                    course=course,
                    title=f"{subject.name} Class {grade} — Chapter Assessment",
                    defaults={
                        "description": (
                            f"Assessment covering core concepts of "
                            f"{subject.name} for Class {grade}."
                        ),
                        "pass_marks": 3,
                        "is_published": True,
                    },
                )
                if assessment_created:
                    assessments_created += 1
                    for order, q_data in enumerate(SAMPLE_QUESTIONS, start=1):
                        question = Question.objects.create(
                            assessment=assessment,
                            text=q_data["text"],
                            marks=1,
                            order=order,
                        )
                        for opt in q_data["options"]:
                            QuestionOption.objects.create(
                                question=question,
                                text=opt["text"],
                                is_correct=opt["is_correct"],
                            )
                        questions_created += 1

        if fallback_used:
            self.stdout.write(self.style.WARNING(
                f"\nFallback titles used for {len(fallback_used)} combinations "
                f"(subject name in DB didn't match template key):\n"
                + "\n".join(f"  - {x}" for x in fallback_used)
            ))

        self.stdout.write(self.style.SUCCESS(
            f"\nCurriculum seeded successfully:\n"
            f"  Courses created:     {courses_created}\n"
            f"  Lessons created:     {lessons_created}\n"
            f"  Assessments created: {assessments_created}\n"
            f"  Questions created:   {questions_created}\n"
            f"\nTotal in database:\n"
            f"  Courses:     {Course.objects.count()}\n"
            f"  Lessons:     {Lesson.objects.count()}\n"
            f"  Assessments: {Assessment.objects.count()}\n"
        ))