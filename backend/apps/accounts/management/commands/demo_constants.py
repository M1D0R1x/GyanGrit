"""
Demo data constants — names, chat messages, config.
"""

TEACHER_MAP = [
    # (existing_username, subject_name, first_name, last_name)
    ("teacher1",  "Computer Science", "Rajveer",   "Dhillon"),
    ("teacher5",  "Biology",          "Gurpreet",  "Brar"),
    ("teacher6",  "Chemistry",        "Amritpal",  "Grewal"),
    ("teacher7",  "English 1",        "Neha",      "Sharma"),
    ("teacher8",  "English 2",        "Priya",     "Mehta"),
    ("teacher9",  "GK",               "Sukhwinder","Gill"),
    ("teacher10", "Hindi",            "Anita",     "Verma"),
    ("teacher11", "Maths",            "Jaspreet",  "Mann"),
    ("teacher12", "Physics",          "Hardeep",   "Sidhu"),
    ("teacher13", "Punjabi",          "Kulwant",   "Bajwa"),
    ("teacher14", "Social 1",         "Manpreet",  "Randhawa"),
    ("teacher15", "Social 2",         "Ravinder",  "Bhullar"),
]

PRINCIPAL_UPDATE = ("principal1", "Harpreet", "Kaur", "Sandhu")

# (first_name, last_name) — 160 unique Indian/Punjabi names
STUDENT_NAMES = [
    # Class 6 (~32)
    ("Arjun", "Singh"), ("Simran", "Kaur"), ("Aarav", "Sharma"),
    ("Mannat", "Gill"), ("Kabir", "Dhillon"), ("Ishaan", "Brar"),
    ("Navya", "Sidhu"), ("Riya", "Mehta"), ("Sahil", "Grewal"),
    ("Ananya", "Verma"), ("Jasleen", "Mann"), ("Gurnoor", "Bajwa"),
    ("Aryan", "Randhawa"), ("Diya", "Bhullar"), ("Harleen", "Sandhu"),
    ("Veer", "Chahal"), ("Meher", "Sethi"), ("Rohan", "Kapoor"),
    ("Preet", "Johal"), ("Kiara", "Bhatia"), ("Gurleen", "Dhaliwal"),
    ("Aditya", "Puri"), ("Noor", "Ahluwalia"), ("Reyansh", "Malhotra"),
    ("Saanvi", "Kang"), ("Tanish", "Oberoi"), ("Avneet", "Virk"),
    ("Shaurya", "Cheema"), ("Manya", "Khanna"), ("Ekam", "Multani"),
    ("Fateh", "Hundal"), ("Inaya", "Kohli"),
    # Class 7 (~30)
    ("Harman", "Singh"), ("Jiya", "Kaur"), ("Arnav", "Sharma"),
    ("Khushi", "Gill"), ("Parth", "Dhillon"), ("Myra", "Brar"),
    ("Divjot", "Sidhu"), ("Tanya", "Mehta"), ("Nihal", "Grewal"),
    ("Palak", "Verma"), ("Japneet", "Mann"), ("Onkar", "Bajwa"),
    ("Sehaj", "Randhawa"), ("Anika", "Bhullar"), ("Raghav", "Sandhu"),
    ("Paras", "Chahal"), ("Zara", "Sethi"), ("Vivaan", "Kapoor"),
    ("Sukhmani", "Johal"), ("Aradhya", "Bhatia"), ("Jashan", "Dhaliwal"),
    ("Rudra", "Puri"), ("Mahira", "Ahluwalia"), ("Pranav", "Malhotra"),
    ("Sia", "Kang"), ("Yuvraj", "Oberoi"), ("Hunar", "Virk"),
    ("Kavya", "Cheema"), ("Dhruv", "Khanna"), ("Amayra", "Multani"),
    # Class 8 (~30)
    ("Gurveer", "Singh"), ("Harsimran", "Kaur"), ("Laksh", "Sharma"),
    ("Nimrat", "Gill"), ("Agam", "Dhillon"), ("Reet", "Brar"),
    ("Joban", "Sidhu"), ("Muskan", "Mehta"), ("Armaan", "Grewal"),
    ("Pari", "Verma"), ("Sahibjot", "Mann"), ("Udham", "Bajwa"),
    ("Kanav", "Randhawa"), ("Mehr", "Bhullar"), ("Yash", "Sandhu"),
    ("Jaskaran", "Chahal"), ("Amaira", "Sethi"), ("Dev", "Kapoor"),
    ("Navneet", "Johal"), ("Bhavya", "Bhatia"), ("Gurfateh", "Dhaliwal"),
    ("Karan", "Puri"), ("Sara", "Ahluwalia"), ("Viraj", "Malhotra"),
    ("Aashna", "Kang"), ("Ranveer", "Oberoi"), ("Simrat", "Virk"),
    ("Maan", "Cheema"), ("Aditi", "Khanna"), ("Rehaan", "Multani"),
    # Class 9 (~32)
    ("Ajitpal", "Singh"), ("Rubina", "Kaur"), ("Krish", "Sharma"),
    ("Seerat", "Gill"), ("Udayveer", "Dhillon"), ("Rabia", "Brar"),
    ("Tegbir", "Sidhu"), ("Sonia", "Mehta"), ("Lovepreet", "Grewal"),
    ("Sneha", "Verma"), ("Baljot", "Mann"), ("Prabhjot", "Bajwa"),
    ("Sukhman", "Randhawa"), ("Gauri", "Bhullar"), ("Harsh", "Sandhu"),
    ("Manjot", "Chahal"), ("Ritika", "Sethi"), ("Ishan", "Kapoor"),
    ("Dilpreet", "Johal"), ("Pooja", "Bhatia"), ("Satnam", "Dhaliwal"),
    ("Mohit", "Puri"), ("Alisha", "Ahluwalia"), ("Varun", "Malhotra"),
    ("Naina", "Kang"), ("Jashanpreet", "Oberoi"), ("Komal", "Virk"),
    ("Bikram", "Cheema"), ("Tamanna", "Khanna"), ("Zorawar", "Multani"),
    ("Resham", "Hundal"), ("Aman", "Kohli"),
    # Class 10 (~30)
    ("Gursharan", "Singh"), ("Ravneet", "Kaur"), ("Aniket", "Sharma"),
    ("Mehak", "Gill"), ("Charanjit", "Dhillon"), ("Rupinder", "Brar"),
    ("Tavleen", "Sidhu"), ("Deepika", "Mehta"), ("Jatinder", "Grewal"),
    ("Ankita", "Verma"), ("Harnoor", "Mann"), ("Navjot", "Bajwa"),
    ("Gurkirat", "Randhawa"), ("Lavanya", "Bhullar"), ("Nikhil", "Sandhu"),
    ("Taranjot", "Chahal"), ("Shreya", "Sethi"), ("Abhishek", "Kapoor"),
    ("Karman", "Johal"), ("Vrinda", "Bhatia"), ("Balraj", "Dhaliwal"),
    ("Rahul", "Puri"), ("Jasmeen", "Ahluwalia"), ("Sumit", "Malhotra"),
    ("Chetna", "Kang"), ("Gurinder", "Oberoi"), ("Mandeep", "Virk"),
    ("Suraj", "Cheema"), ("Nikita", "Khanna"), ("Harshal", "Multani"),
]

# Students per grade (index into STUDENT_NAMES)
GRADE_SLICES = {
    6: (0, 32),
    7: (32, 62),
    8: (62, 92),
    9: (92, 124),
    10: (124, 154),
}

MOBILES_PRIMARY = ["8886862150", "6283802486"]
MOBILES_SECONDARY = ["8639544884", "9392443191"]
EMAIL_BASES = ["veerababusaviti2103", "veerababusaviti123"]

# ── Chat message templates ──────────────────────────────────────────────
STAFF_MESSAGES = [
    ("Good morning everyone. Please submit your weekly lesson plans by Wednesday.",),
    ("Reminder: PTM is scheduled for next Saturday. Please prepare student reports.",),
    ("The science lab equipment has been restocked. Teachers can use Lab 2 from tomorrow.",),
    ("Class 8 students are falling behind in assessments. Let's discuss remedial classes.",),
    ("Great news — our school has been selected for the district science exhibition!",),
    ("Please make sure to update lesson progress on GyanGrit daily.",),
    ("Sports day practice starts next week. PE period adjustments will be shared.",),
    ("The new projector for Room 3 has arrived. IT team will install it tomorrow.",),
    ("Mid-term exam schedule will be finalized this Friday. Please share your inputs.",),
    ("Excellent work by Class 10 students in the inter-school quiz competition!",),
]

def get_subject_messages(subject_name):
    """Return (teacher_msgs, student_msgs) for a subject."""
    base_teacher = [
        f"Welcome to {subject_name} class. Please open your textbooks to Chapter 3.",
        f"Tomorrow's {subject_name} class will have a short revision quiz. Please prepare.",
        f"I've uploaded new notes for the current chapter. Check the lessons section.",
        f"Homework: Complete exercise questions 1-10 from the textbook by Friday.",
        f"Good work on the last assessment everyone. Keep up the effort!",
    ]
    base_student = [
        f"Sir/Ma'am, can you explain the last topic again? I didn't understand fully.",
        "What chapters are included in the upcoming test?",
        "Thank you for the notes, they were very helpful!",
        "Can we get extra practice questions for this chapter?",
        "When will the assessment results be shared?",
        "I'm having trouble with question 7, can anyone help?",
        "Is the homework due tomorrow or day after?",
        "The video lesson was really good, learned a lot from it.",
    ]
    return base_teacher, base_student
