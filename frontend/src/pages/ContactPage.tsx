import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { toast } from "sonner";
import { apiPost } from "../services/api";
import "./PublicPages.css";

export default function ContactPage() {
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: "", email: "", message: "" });
  const [sending, setSending] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSending(true);

    // Minimum 1.5s for tactile UX feel
    const minDelay = new Promise((r) => setTimeout(r, 1500));

    try {
      const [res] = await Promise.all([apiPost("/accounts/contact/", form), minDelay]) as [{ success?: boolean; error?: string }, unknown];
      if (res?.error) throw new Error(res.error);

      toast.success("Message sent! We'll get back to you within 24 hours.", { duration: 5000 });
      setForm({ name: "", email: "", message: "" });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to send message. Please try again.";
      toast.error(msg, { duration: 5000 });
    } finally {
      setSending(false);
    }
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

      <main className="public-content">
        {/* Hero */}
        <section className="public-hero">
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
                  disabled={sending}
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
                  disabled={sending}
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
                  disabled={sending}
                />
              </div>
              <button type="submit" className="btn btn--primary btn--full btn--lg" disabled={sending}>
                {sending ? (
                  <><span className="btn__spinner" aria-hidden="true" /> Sending…</>
                ) : "Send Message"}
              </button>
            </form>
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
