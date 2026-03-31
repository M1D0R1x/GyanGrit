import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import "./PublicPages.css";
export default function ContactPage() {
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: "", email: "", message: "" });
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Static form — just show success for now
    setSubmitted(true);
  };

  return (
    <div className="public-page">
      <Helmet>
        <title>Contact GyanGrit | Get in Touch with Our Team</title>
        <meta name="description" content="Have questions about implementing GyanGrit in your institution? Contact our support and implementation team today." />
      </Helmet>
      <nav className="public-nav">
        <button className="public-nav__brand" onClick={() => navigate("/")}>
          Gyan<span>Grit</span>
        </button>
        <div className="public-nav__links">
          <button onClick={() => navigate("/about")} className="public-nav__link">About</button>
          <button onClick={() => navigate("/contact")} className="public-nav__link public-nav__link--active">Contact</button>
          <button onClick={() => navigate("/faq")} className="public-nav__link">FAQ</button>
          <button onClick={() => navigate("/login")} className="btn btn--primary">Sign In</button>
        </div>
      </nav>

      
        <section className="public-hero">
          <div className="public-hero__badge">Get in Touch</div>
          <h1 className="public-hero__title">
            We'd Love to<br />
            <span className="public-hero__highlight">Hear From You</span>
          </h1>
          <p className="public-hero__subtitle">
            Have a question, suggestion, or partnership idea? Reach out and we'll get back to you.
          </p>
        </section>

        <div className="contact-layout">
          {/* Contact Form */}
          <div className="contact-form-wrapper">
            {submitted ? (
              <div className="contact-success page-enter">
                <div className="contact-success__icon">✉️</div>
                <h3 className="contact-success__title">Message Received!</h3>
                <p className="contact-success__desc">
                  Thank you for reaching out. We'll get back to you within 24 hours.
                </p>
                <button
                  className="btn btn--secondary"
                  onClick={() => { setSubmitted(false); setForm({ name: "", email: "", message: "" }); }}
                >
                  Send Another Message
                </button>
              </div>
            ) : (
              <form className="contact-form" onSubmit={handleSubmit}>
                <div className="form-group">
                  <label className="form-label" htmlFor="contact-name">Your Name</label>
                  <input
                    id="contact-name"
                    className="form-input"
                    type="text"
                    placeholder="Enter your full name"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    required
                  />
                </div>
                <div className="form-group">
                  <label className="form-label" htmlFor="contact-email">Email Address</label>
                  <input
                    id="contact-email"
                    className="form-input"
                    type="email"
                    placeholder="you@example.com"
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                    required
                  />
                </div>
                <div className="form-group">
                  <label className="form-label" htmlFor="contact-message">Message</label>
                  <textarea
                    id="contact-message"
                    className="form-input form-input--textarea"
                    placeholder="Tell us how we can help..."
                    value={form.message}
                    onChange={(e) => setForm({ ...form, message: e.target.value })}
                    required
                    rows={5}
                  />
                </div>
                <button type="submit" className="btn btn--primary btn--full btn--lg">
                  Send Message
                </button>
              </form>
            )}
          </div>

          {/* Contact Info Sidebar */}
          <div className="contact-info">
            <div className="contact-info__card">
              <div className="contact-info__icon">📧</div>
              <h4 className="contact-info__title">Email</h4>
              <p className="contact-info__value">admin@gyangrit.site</p>
            </div>
            <div className="contact-info__card">
              <div className="contact-info__icon">🌐</div>
              <h4 className="contact-info__title">Website</h4>
              <p className="contact-info__value">gyangrit.site</p>
            </div>
            <div className="contact-info__card">
              <div className="contact-info__icon">📍</div>
              <h4 className="contact-info__title">Location</h4>
              <p className="contact-info__value">Punjab, India</p>
            </div>
            <div className="contact-info__card">
              <div className="contact-info__icon">⏰</div>
              <h4 className="contact-info__title">Response Time</h4>
              <p className="contact-info__value">Within 24 hours</p>
            </div>
          </div>
        </div>
      

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
