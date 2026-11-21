import { Link } from 'react-router-dom'
import { ArrowLeft, Activity, Mail, ShieldCheck } from 'lucide-react'

const supportEmail = 'HAPTECHINDIA@GMAIL.COM'

function PolicyLayout({ title, eyebrow, children }) {
  return (
    <>
      <header className="topbar">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <Link className="brand" to="/">
            <span className="brand-mark"><Activity size={19} /></span>
            <span>event<span className="brand-light">flow</span></span>
            <span className="brand-tag">EVENT OPERATIONS</span>
          </Link>
          <span className="powered-badge">Powered by <b>HAPTECH</b></span>
        </div>
        <nav>
          <Link to="/">Explore events</Link>
          <Link to="/admin">Organiser login</Link>
        </nav>
      </header>
      <main className="wrap policy-page">
        <Link className="back-link" to="/"><ArrowLeft size={15}/> Back to EventFlow</Link>
        <div className="policy-card">
          <div className="eyebrow">{eyebrow}</div>
          <h1>{title}</h1>
          {children}
          <p className="policy-updated">Last updated: 21 November 2026 · Operated by Haptech (Haptech India)</p>
        </div>
      </main>
      <footer className="footer wrap">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Link className="brand" to="/">
              <span className="brand-mark"><Activity size={17}/></span>
              <span>event<span className="brand-light">flow</span></span>
            </Link>
            <span style={{ fontSize: 11, color: '#687e70' }}>· Powered by <b>HAPTECH</b></span>
          </div>
          <small style={{ color: '#829588', fontSize: 11 }}>
            © {new Date().getFullYear()} Haptech (Haptech India). All rights reserved. Payments secured via Cashfree.
          </small>
        </div>
        <span>
          <Link to="/contact">Contact</Link> · <Link to="/terms">Terms</Link> · <Link to="/refunds">Refunds</Link> · <Link to="/services">Services & pricing</Link>
        </span>
      </footer>
    </>
  )
}

export function ContactPage() {
  return (
    <PolicyLayout title="Contact Us" eyebrow="CUSTOMER SUPPORT">
      <p>EventFlow is developed, hosted, and operated by <b>Haptech (Haptech India)</b>. Contact our team for assistance with event registrations, Cashfree payment processing, platform fee billing, or organiser accounts.</p>
      <div className="policy-contact">
        <Mail/>
        <div>
          <b>Email support & merchant inquiries</b>
          <p><a href={`mailto:${supportEmail}`}>{supportEmail}</a></p>
        </div>
      </div>
      <div className="policy-contact">
        <ShieldCheck/>
        <div>
          <b>Operating entity & support hours</b>
          <p>Haptech (Haptech India) · Monday–Saturday, 10:00 AM–6:00 PM IST (excluding public holidays). Response time within 2–3 business days.</p>
        </div>
      </div>
      <h2>What to include in your request</h2>
      <ul>
        <li>Event name and registration code, if applicable</li>
        <li>Cashfree payment order or transaction reference ID for payment issues</li>
        <li>A concise description of the inquiry</li>
      </ul>
      <p>Event organisers configure event schedules, venues, rules, and participant categories. For event-specific arrangements, contact the respective organiser directly.</p>
    </PolicyLayout>
  )
}

export function TermsPage() {
  return (
    <PolicyLayout title="Terms & Conditions" eyebrow="PLATFORM TERMS">
      <p>By accessing or using EventFlow, you agree to these terms. EventFlow is a digital event technology and operations platform operated by <b>Haptech (Haptech India)</b>.</p>
      <h2>1. Platform ownership & services</h2>
      <p>EventFlow is owned, maintained, and operated by Haptech. Haptech provides cloud-based digital tools for event discovery, online participant registration, ticketing, Cashfree payment processing, and event-day check-in.</p>
      <h2>2. Freemium model & organiser billing</h2>
      <p>EventFlow operates on a freemium pricing structure: the first three (3) events created by any organisation are free of platform fees. Commencing from the 4th event, a one-time platform access fee of ₹999 INR per event applies before publication. There are no recurring monthly or annual platform subscription charges.</p>
      <h2>3. Event organisers</h2>
      <p>Organisers are responsible for the accuracy of event details, eligibility, tickets, venues, and compliance with local regulations. EventFlow and Haptech provide technology infrastructure and payment collection facilities.</p>
      <h2>4. Registrations and payments</h2>
      <p>All online payments on EventFlow are processed through Cashfree Payments India under merchant entity <b>Haptech</b>. Displayed prices are in Indian Rupees (INR). Registrations are confirmed upon successful payment verification by Cashfree.</p>
      <h2>5. User information & privacy</h2>
      <p>Users must provide accurate information. Participant contact data is collected strictly to administer the event and issue digital bib/QR passes.</p>
      <h2>6. Acceptable use</h2>
      <p>Users must not misuse the platform, attempt unauthorised access, circumvent event quotas through multiple accounts, submit fraudulent payment details, or violate applicable laws.</p>
      <h2>7. Refunds and cancellations</h2>
      <p>Refund eligibility is governed by the event organiser's terms and the <Link to="/refunds">Refunds & Cancellations Policy</Link>. Event-specific terms shown during registration take precedence where applicable.</p>
      <h2>8. Merchant contact</h2>
      <p>For questions regarding platform operations, merchant billing, or technical support, visit our <Link to="/contact">Contact Us</Link> page or email <a href={`mailto:${supportEmail}`}>{supportEmail}</a>.</p>
    </PolicyLayout>
  )
}

export function RefundsPage() {
  return (
    <PolicyLayout title="Refunds & Cancellations" eyebrow="PAYMENT POLICY">
      <p>All online transactions on EventFlow are processed securely through Cashfree Payments under merchant entity <b>Haptech (Haptech India)</b>.</p>
      <h2>EventFlow Platform Event Fees (Organisers)</h2>
      <p>The ₹999 platform access fee per event covers hosting, Cashfree checkout infrastructure, QR generation, and platform availability provided by Haptech. Platform fees are one-time payments and become non-refundable once an event is published and open for registrations. If an error occurs prior to publication, contact support for resolution.</p>
      <h2>Event cancelled by organiser</h2>
      <p>If an event is cancelled, the organiser will communicate whether registrations will be refunded, transferred, or otherwise resolved. Approved refunds are initiated by Haptech through Cashfree directly back to the original payment method.</p>
      <h2>Participant cancellation</h2>
      <p>Participant-requested cancellations are subject to the specific event organiser's published policy. Please check the event page for details.</p>
      <h2>Duplicate payment</h2>
      <p>If you believe you paid more than once for the same registration, contact support at <a href={`mailto:${supportEmail}`}>{supportEmail}</a> with your payment transaction references. Verified duplicate transactions will be reviewed and refunded.</p>
      <h2>Payment deducted but registration not confirmed</h2>
      <p>Contact us or the organiser with your Cashfree payment transaction reference. Verified failed or unmatched payments will be investigated and resolved promptly.</p>
      <h2>Refund timelines</h2>
      <p>Approved refunds are processed through Cashfree to the original payment source (UPI, Card, Netbanking) and typically reflect within 5–7 business days depending on your bank.</p>
    </PolicyLayout>
  )
}

export function ServicesPage() {
  return (
    <PolicyLayout title="Services & Pricing" eyebrow="PRODUCTS AND SERVICES">
      <p>EventFlow, developed and operated by <b>Haptech (Haptech India)</b>, provides comprehensive event registration and operations infrastructure with transparent freemium pricing. All displayed prices are in Indian Rupees (INR).</p>
      <div className="policy-pricing">
        <article>
          <span>01</span>
          <h2>Free Tier (First 3 Events)</h2>
          <p>Every newly registered organisation receives full access to create and run its first 3 events completely free.</p>
          <b>₹0 (Free Plan)</b>
          <small>Includes event registration pages, Cashfree checkout, QR check-in & CSV export.</small>
        </article>
        <article>
          <span>02</span>
          <h2>Pay-Per-Event (4th Event Onwards)</h2>
          <p>After using the 3 free events, subsequent events require a single platform access fee. No monthly subscriptions.</p>
          <b>₹999 per event</b>
          <small>One-time fee per event. Unlimited registrations and full dashboard access.</small>
        </article>
        <article>
          <span>03</span>
          <h2>Participant Registrations</h2>
          <p>Organisers configure category-specific registration ticket fees for runs, sports meets and community events.</p>
          <b>Custom per event</b>
          <small>Actual ticket price is configured by each organiser and shown on the public event page.</small>
        </article>
        <article>
          <span>04</span>
          <h2>Enterprise & Bulk Programmes</h2>
          <p>State federations, university sports boards, and high-frequency event circuits needing custom quotas.</p>
          <b>Custom / Quota grant</b>
          <small>Contact support at <a href={`mailto:${supportEmail}`}>{supportEmail}</a> for complimentary waivers or custom quotas.</small>
        </article>
      </div>
      <p>EventFlow and Haptech provide software tools, ticketing workflows, and payment infrastructure. Event delivery, event fees, and on-ground arrangements are managed by the respective event organiser.</p>
    </PolicyLayout>
  )
}
