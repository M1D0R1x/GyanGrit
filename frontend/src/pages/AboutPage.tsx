import { useNavigate } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import "./PublicPages.css";
export default function AboutPage() {
  const navigate = useNavigate();

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
          <button onClick={() => navigate("/login")} className="btn btn--primary">Sign In</button>
        </div>
      </nav>

      
        {/* Hero Section */}
        <section className="public-hero">
          <div className="public-hero__badge">Our Mission</div>
          <h1 className="public-hero__title">
            Empowering Rural Students,<br />
            <span className="public-hero__highlight">One Lesson at a Time</span>
          </h1>
          <p className="public-hero__subtitle">
            GyanGrit is a digital education platform built for students in rural Punjab.
            We believe every child, regardless of their location or connectivity,
            deserves access to world-class education tools.
          </p>
        </section>

        {/* Values Grid */}
        <section className="public-section">
          <h2 className="public-section__title">What We Stand For</h2>
          <div className="public-grid public-grid--3">
            <div className="public-card">
              <div className="public-card__icon">📡</div>
              <h3 className="public-card__title">Offline-First</h3>
              <p className="public-card__desc">
                Our PWA works without internet. Students can study flashcards,
                review lessons, and take quizzes even in areas with zero connectivity.
              </p>
            </div>
            <div className="public-card">
              <div className="public-card__icon">🎯</div>
              <h3 className="public-card__title">Adaptive Learning</h3>
              <p className="public-card__desc">
                Spaced repetition flashcards, personalized learning paths,
                and AI-powered tutoring adapt to each student's pace and ability.
              </p>
            </div>
            <div className="public-card">
              <div className="public-card__icon">🔒</div>
              <h3 className="public-card__title">Secure & Private</h3>
              <p className="public-card__desc">
                Single-device sessions, encrypted communications, and role-based
                access ensure student data stays protected at all times.
              </p>
            </div>
            <div className="public-card">
              <div className="public-card__icon">📹</div>
              <h3 className="public-card__title">Live Sessions</h3>
              <p className="public-card__desc">
                Teachers conduct real-time video classes with interactive whiteboards,
                hand-raise features, and attendance tracking built in.
              </p>
            </div>
            <div className="public-card">
              <div className="public-card__icon">🏆</div>
              <h3 className="public-card__title">Gamification</h3>
              <p className="public-card__desc">
                Points, badges, streaks, and leaderboards keep students motivated
                and make learning feel like a rewarding challenge.
              </p>
            </div>
            <div className="public-card">
              <div className="public-card__icon">🤖</div>
              <h3 className="public-card__title">AI Tutor</h3>
              <p className="public-card__desc">
                Powered by Google Gemini, our AI chatbot answers questions in
                English, Hindi, and Punjabi — supporting multilingual learners.
              </p>
            </div>
          </div>
        </section>

        {/* Platform Stats */}
        <section className="public-section">
          <h2 className="public-section__title">Built at Scale</h2>
          <div className="public-grid public-grid--4">
            <div className="public-stat">
              <div className="public-stat__value">16</div>
              <div className="public-stat__label">Backend Apps</div>
            </div>
            <div className="public-stat">
              <div className="public-stat__value">41</div>
              <div className="public-stat__label">Frontend Pages</div>
            </div>
            <div className="public-stat">
              <div className="public-stat__value">5</div>
              <div className="public-stat__label">User Roles</div>
            </div>
            <div className="public-stat">
              <div className="public-stat__value">13</div>
              <div className="public-stat__label">SRS Requirements Met</div>
            </div>
          </div>
        </section>

        {/* Meet the Team */}
        <section className="public-section">
          <h2 className="public-section__title">The Team Behind GyanGrit</h2>
          <p className="public-section__desc">
            Built as a B.Tech Computer Science Capstone Project at Lovely Professional University (Class of 2026).
          </p>
          <div className="public-grid public-grid--3">
            <div className="public-card" style={{ display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center" }}>
              <div className="public-card__icon" style={{ fontSize: "3rem", marginBottom: "var(--space-4)" }}>👩🏻‍💻</div>
              <h3 className="public-card__title">Kode Sai harshitha</h3>
              <p className="public-card__desc">Developer</p>
            </div>
            <div className="public-card" style={{ display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center" }}>
              <div className="public-card__icon" style={{ fontSize: "3rem", marginBottom: "var(--space-4)" }}>👨🏻‍💻</div>
              <h3 className="public-card__title">Saviti Veerababu</h3>
              <p className="public-card__desc">Developer</p>
            </div>
            <div className="public-card" style={{ display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center" }}>
              <div className="public-card__icon" style={{ fontSize: "3rem", marginBottom: "var(--space-4)" }}>👨🏻‍💻</div>
              <h3 className="public-card__title">Tathineni Govardhan</h3>
              <p className="public-card__desc">Developer</p>
            </div>
          </div>
        </section>

        {/* Tech Stack */}
        <section className="public-section">
          <h2 className="public-section__title">Our Technology</h2>
          <p className="public-section__desc">
            GyanGrit is built on a modern, battle-tested technology stack designed
            for reliability, performance, and scale.
          </p>
          <div className="public-grid public-grid--2">
            <div className="public-card public-card--compact">
              <h4 className="public-card__title">Frontend</h4>
              <p className="public-card__desc">React 18, TypeScript, Vite, Vercel Edge Network (Mumbai)</p>
            </div>
            <div className="public-card public-card--compact">
              <h4 className="public-card__title">Backend</h4>
              <p className="public-card__desc">Django 4.2, Gunicorn, Nginx, Oracle Cloud (Mumbai)</p>
            </div>
            <div className="public-card public-card--compact">
              <h4 className="public-card__title">Database</h4>
              <p className="public-card__desc">PostgreSQL via Supabase, Upstash Redis for sessions & caching</p>
            </div>
            <div className="public-card public-card--compact">
              <h4 className="public-card__title">Real-time</h4>
              <p className="public-card__desc">Ably Pub/Sub, LiveKit WebRTC, Google Gemini AI</p>
            </div>
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
