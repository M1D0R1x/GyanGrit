import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import "./PublicPages.css";
const FAQ_ITEMS = [
  {
    q: "How do I create an account?",
    a: "Click 'Register' on the login page and enter the Join Code provided by your school administrator. Join Codes are unique to each institution, grade, and role — your school admin will distribute them to you.",
  },
  {
    q: "What is a Join Code?",
    a: "A Join Code is a unique alphanumeric code created by your school admin or district official. It ties your account to a specific school, class section, and role (Student, Teacher, Principal, or Official). Without a valid Join Code, you cannot register.",
  },
  {
    q: "I forgot my password. What should I do?",
    a: "Click 'Forgot password?' on the login page. Enter your username or email address, and we'll send a password reset link to your registered email. The link expires in 1 hour. If you don't see the email, check your spam folder.",
  },
  {
    q: "Why do I need to enter an OTP?",
    a: "For security, Teachers, Principals, and Officials must verify their identity with a One-Time Password (OTP) sent to their registered email. This ensures that only authorized personnel can access administrative features. Students bypass OTP for faster access.",
  },
  {
    q: "Can I use GyanGrit offline?",
    a: "Yes! GyanGrit is a Progressive Web App (PWA). Once installed on your device, you can study flashcards, review lessons, and take quizzes even without an internet connection. Your progress will sync automatically when you reconnect.",
  },
  {
    q: "What are flashcards and how do they work?",
    a: "Flashcards use spaced repetition (the SM-2 algorithm, same as Anki) to help you memorize concepts efficiently. Cards you find easy are shown less often, while difficult cards appear more frequently until you master them.",
  },
  {
    q: "How do live sessions work?",
    a: "Teachers can schedule and host live video sessions using WebRTC (LiveKit). Students join directly from the app with features like hand-raise, in-room chat, interactive whiteboards, and automatic attendance tracking.",
  },
  {
    q: "What is the AI Tutor?",
    a: "The AI Tutor is powered by Google Gemini with a 1M context window. It can answer questions in English, Hindi, and Punjabi. It uses your course content as context to provide relevant, subject-specific help.",
  },
  {
    q: "Can I use GyanGrit on multiple devices?",
    a: "For security (FR-02 of our SRS), GyanGrit enforces single-device sessions. If you log in on a new device, your previous session will be automatically terminated. This prevents unauthorized account sharing.",
  },
  {
    q: "How do competitions work?",
    a: "Teachers create competition rooms with questions. Students join in real-time with Ably pub/sub messaging, and leaderboards update live as participants submit answers. It's a gamified quiz experience that encourages friendly rivalry.",
  },
  {
    q: "Is my data secure?",
    a: "Absolutely. We use HTTPS/TLS encryption, CSRF protection, single-device session enforcement, role-based access control (RBAC), and Sentry error monitoring. Your data is stored securely in Supabase PostgreSQL with encrypted connections.",
  },
  {
    q: "Who maintains GyanGrit?",
    a: "GyanGrit is a capstone project built for empowering rural education in Punjab. It's actively maintained and continuously improved with new features, performance optimizations, and security updates.",
  },
];

export default function FAQPage() {
  const navigate = useNavigate();
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  const toggle = (i: number) => {
    setOpenIndex(openIndex === i ? null : i);
  };

  return (
    <div className="public-page">
      <Helmet>
        <title>FAQ | GyanGrit Document Portal</title>
        <meta name="description" content="Frequently asked questions about GyanGrit's offline capabilities, gamification, AI tutor, and school enrollment process." />
      </Helmet>
      <nav className="public-nav">
        <button className="public-nav__brand" onClick={() => navigate("/")}>
          Gyan<span>Grit</span>
        </button>
        <div className="public-nav__links">
          <button onClick={() => navigate("/about")} className="public-nav__link">About</button>
          <button onClick={() => navigate("/contact")} className="public-nav__link">Contact</button>
          <button onClick={() => navigate("/faq")} className="public-nav__link public-nav__link--active">FAQ</button>
          <button onClick={() => navigate("/login")} className="btn btn--primary">Sign In</button>
        </div>
      </nav>

      <main className="public-content page-enter">
        <section className="public-hero">
          <div className="public-hero__badge">Help Center</div>
          <h1 className="public-hero__title">
            Frequently Asked<br />
            <span className="public-hero__highlight">Questions</span>
          </h1>
          <p className="public-hero__subtitle">
            Everything you need to know about GyanGrit. Can't find what you're looking for?{" "}
            <button
              onClick={() => navigate("/contact")}
              style={{
                background: "none", border: "none", color: "var(--saffron)",
                cursor: "pointer", fontFamily: "inherit", fontSize: "inherit",
                textDecoration: "underline", textUnderlineOffset: "3px", padding: 0,
              }}
            >
              Contact us
            </button>.
          </p>
        </section>

        <section className="faq-list">
          {FAQ_ITEMS.map((item, i) => (
            <div
              key={i}
              className={`faq-item ${openIndex === i ? "faq-item--open" : ""}`}
            >
              <button className="faq-item__question" onClick={() => toggle(i)}>
                <span>{item.q}</span>
                <svg
                  className="faq-item__chevron"
                  width="20" height="20" viewBox="0 0 24 24"
                  fill="none" stroke="currentColor" strokeWidth="2"
                  strokeLinecap="round" strokeLinejoin="round"
                >
                  <polyline points="6 9 12 15 18 9" />
                </svg>
              </button>
              <div className="faq-item__answer">
                <p>{item.a}</p>
              </div>
            </div>
          ))}
        </section>

        {/* CTA */}
        <section className="public-cta">
          <h2 className="public-cta__title">Still Have Questions?</h2>
          <p className="public-cta__desc">
            Our team is happy to help. Reach out and we'll respond within 24 hours.
          </p>
          <div className="public-cta__actions">
            <button className="btn btn--primary btn--lg" onClick={() => navigate("/contact")}>
              Contact Us
            </button>
            <button className="btn btn--secondary btn--lg" onClick={() => navigate("/register")}>
              Create an Account
            </button>
          </div>
        </section>
      </main>

      <footer className="public-footer">
        <div className="public-footer__brand">Gyan<span>Grit</span></div>
        <p className="public-footer__copy">© {new Date().getFullYear()} GyanGrit. All rights reserved.</p>
        <div className="public-footer__links">
          <button onClick={() => navigate("/about")}>About</button>
          <button onClick={() => navigate("/contact")}>Contact</button>
          <button onClick={() => navigate("/faq")}>FAQ</button>
        </div>
      </footer>
    </div>
  );
}
