import { useNavigate } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { useAuth } from "../auth/AuthContext";
import "./PublicPages.css";

export default function AboutPage() {
  const navigate = useNavigate();
  const auth = useAuth();
  const isLoggedIn = !!auth.user;

  return (
    <div className="public-page">
      <Helmet>
        <title>About GyanGrit | Empowering Rural Students in Punjab</title>
        <meta name="description" content="Learn about GyanGrit, the digital education platform built as a capstone project to bring offline-first, gamified learning to rural areas." />
      </Helmet>
      <nav className="public-nav">
        <button className="public-nav__brand" onClick={() => navigate("/")}>
          Gyan<span>Grit</span>
        </button>
        <div className="public-nav__links">
          <button onClick={() => navigate("/about")} className="public-nav__link public-nav__link--active">About</button>
          <button onClick={() => navigate("/contact")} className="public-nav__link">Contact</button>
          <button onClick={() => navigate("/faq")} className="public-nav__link">FAQ</button>
          {isLoggedIn ? (
            <button onClick={() => navigate("/dashboard")} className="btn btn--primary">Dashboard</button>
          ) : (
            <button onClick={() => navigate("/login")} className="btn btn--primary">Sign In</button>
          )}
        </div>
      </nav>

      <main className="public-content">
        {/* Hero */}
        <section className="public-hero" style={{ marginBottom: "7rem" }}>
          <h1 className="public-hero__title">
            Empowering Rural Students,<br />
            <span className="public-hero__highlight">One Lesson at a Time</span>
          </h1>
          <p className="public-hero__subtitle">
            GyanGrit is a digital education platform built for students in rural Punjab.
            We believe every child, regardless of location or connectivity,
            deserves access to world-class education tools.
          </p>
        </section>

        {/* What We Stand For */}
        <section className="public-section">
          <h2 className="public-section__title">What We Stand For</h2>
          <div className="public-grid public-grid--3">
            <div className="public-card">
              <span className="public-card__icon">📡</span>
              <h3 className="public-card__title">Offline-First</h3>
              <p className="public-card__desc">
                Our PWA works without internet. Students can study flashcards,
                review lessons, and take quizzes even in areas with zero connectivity.
              </p>
            </div>
            <div className="public-card">
              <span className="public-card__icon">🎯</span>
              <h3 className="public-card__title">Adaptive Learning</h3>
              <p className="public-card__desc">
                Spaced repetition flashcards, personalized learning paths,
                and AI-powered tutoring adapt to each student's pace and ability.
              </p>
            </div>
            <div className="public-card">
              <span className="public-card__icon">🔒</span>
              <h3 className="public-card__title">Secure &amp; Private</h3>
              <p className="public-card__desc">
                Single-device sessions, encrypted communications, and role-based
                access ensure student data stays protected at all times.
              </p>
            </div>
            <div className="public-card">
              <span className="public-card__icon">📹</span>
              <h3 className="public-card__title">Live Sessions</h3>
              <p className="public-card__desc">
                Teachers conduct real-time video classes with interactive whiteboards,
                hand-raise features, and attendance tracking built in.
              </p>
            </div>
            <div className="public-card">
              <span className="public-card__icon">🏆</span>
              <h3 className="public-card__title">Gamification</h3>
              <p className="public-card__desc">
                Points, badges, streaks, and leaderboards keep students motivated
                and make learning feel like a rewarding challenge.
              </p>
            </div>
            <div className="public-card">
              <span className="public-card__icon">🤖</span>
              <h3 className="public-card__title">AI Tutor</h3>
              <p className="public-card__desc">
                Powered by Google Gemini, our AI chatbot answers questions in
                English, Hindi, and Punjabi — supporting multilingual learners.
              </p>
            </div>
          </div>
        </section>

        {/* Impact Stats */}
        <section className="public-section" style={{ marginTop: "6rem" }}>
          <h2 className="public-section__title">Making a Difference</h2>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--space-5)", justifyContent: "center" }}>
            <div className="public-stat" style={{ flex: "0 1 210px" }}>
              <div className="public-stat__value">12+</div>
              <div className="public-stat__label">Rural Districts</div>
            </div>
            <div className="public-stat" style={{ flex: "0 1 210px" }}>
              <div className="public-stat__value">15k+</div>
              <div className="public-stat__label">Students Impacted</div>
            </div>
            <div className="public-stat" style={{ flex: "0 1 210px" }}>
              <div className="public-stat__value">1.2k+</div>
              <div className="public-stat__label">Interactive Lessons</div>
            </div>
            <div className="public-stat" style={{ flex: "0 1 210px" }}>
              <div className="public-stat__value">100%</div>
              <div className="public-stat__label">Offline Capable</div>
            </div>
          </div>
        </section>

        {/* Team */}
        <section className="public-section">
          <h2 className="public-section__title">The Team Behind GyanGrit</h2>
          <p className="public-section__desc">
            Built as a B.Tech Computer Science Capstone Project at Lovely Professional University (Class of 2026).
          </p>
          <div className="public-grid public-grid--3">
            <div className="public-card" style={{ textAlign: "center" }}>
              <span className="public-card__icon" style={{ fontSize: "3.25rem" }}>👩🏻‍💻</span>
              <h3 className="public-card__title">Kode Sai Harshitha</h3>
              <p className="public-card__desc">Full-Stack Developer</p>
            </div>
            <div className="public-card" style={{ textAlign: "center" }}>
              <span className="public-card__icon" style={{ fontSize: "3.25rem" }}>👨🏾‍💻</span>
              <h3 className="public-card__title">Saviti Veerababu</h3>
              <p className="public-card__desc">Backend &amp; DevOps Engineer</p>
            </div>
            <div className="public-card" style={{ textAlign: "center" }}>
              <span className="public-card__icon" style={{ fontSize: "3.25rem" }}>🧑🏽‍💻</span>
              <h3 className="public-card__title">Tathineni Govardhan</h3>
              <p className="public-card__desc">Frontend &amp; UI Engineer</p>
            </div>
          </div>
        </section>

        {/* Vision */}
        <section style={{ maxWidth: "800px", margin: "8rem auto 4rem", textAlign: "center" }}>
          <h2 className="public-section__title" style={{ textAlign: "center" }}>Our Vision</h2>
          <div className="public-card" style={{ padding: "var(--space-12)", textAlign: "center" }}>
            <p style={{ fontSize: "1.15rem", color: "var(--ink-primary)", marginBottom: "var(--space-8)", lineHeight: "1.9", textAlign: "center", fontStyle: "italic" }}>
              "To bridge the digital divide in rural education by providing high-quality,
              accessible, and gamified learning experiences that work even without
              an internet connection."
            </p>
            <p style={{ fontSize: "var(--text-base)", color: "var(--ink-secondary)", lineHeight: "1.8", textAlign: "center", margin: 0 }}>
              GyanGrit was born from the realization that while digital tools are transforming
              education in cities, rural areas are often left behind due to infrastructure
              challenges. We are committed to changing that narrative, one village at a time.
            </p>
          </div>
        </section>

        {/* CTA */}
        <section className="public-cta">
          <h2 className="public-cta__title">Ready to Transform Learning?</h2>
          <p className="public-cta__desc">
            Join GyanGrit today and give your students the tools they need to succeed.
          </p>
          <div className="public-cta__actions">
            <button className="btn btn--primary btn--lg" onClick={() => navigate("/register")}>
              Get Started
            </button>
            <button className="btn btn--secondary btn--lg" onClick={() => navigate("/contact")}>
              Contact Us
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
