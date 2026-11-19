import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, Route, Routes, useNavigate, useParams } from 'react-router-dom'
import { Html5Qrcode } from 'html5-qrcode'
import { QRCodeSVG } from 'qrcode.react'
import {
  Activity, ArrowLeft, ArrowRight, BadgeCheck, CalendarDays, Check, CheckCircle2,
  ChevronDown, ClipboardList, Clock3, Download, ExternalLink, FileImage, Globe2,
  LayoutDashboard, LogIn, LogOut, Mail, MapPin, Menu, Plus, QrCode, RefreshCw,
  Search, ShieldCheck, Ticket, Users, Wallet, X, XCircle, Zap,
} from 'lucide-react'
import { isSupabaseConfigured, supabase } from './lib/supabase'
import { ContactPage, TermsPage, RefundsPage, ServicesPage } from './LegalPages'

const money = (amount, currency = 'INR') => new Intl.NumberFormat('en-IN', {
  style: 'currency', currency, maximumFractionDigits: 0,
}).format(Number(amount || 0))
const prettyDate = (date) => date ? new Date(`${date}T00:00:00`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : 'Date to be announced'
const slugify = (s) => s.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 55)
const shortDate = (stamp) => new Date(stamp).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })

function Notice({ kind = 'info', children, onClose }) {
  if (!children) return null
  const Icon = kind === 'success' ? CheckCircle2 : kind === 'error' ? XCircle : Activity
  return <div className={`notice ${kind}`}><Icon size={17} /><span>{children}</span>{onClose && <button className="icon-btn" onClick={onClose} aria-label="Close"><X size={15} /></button>}</div>
}

function SiteHeader({ admin = false }) {
  return <header className="topbar"><Link className="brand" to="/"><span className="brand-mark"><Activity size={19} /></span><span>event<span className="brand-light">flow</span></span><span className="brand-tag">EVENT OPERATIONS</span></Link><nav><Link to="/">Explore events</Link><Link className={admin ? 'nav-active' : 'nav-cta'} to="/admin">{admin ? 'Admin workspace' : 'Organiser login'} <ArrowRight size={15} /></Link></nav></header>
}

function SetupBanner() {
  if (isSupabaseConfigured) return null
  return <div className="setup-banner"><ShieldCheck size={18} /><div><b>Supabase setup required</b><span>Add your Supabase URL and publishable key to <code>.env.local</code>, then run the SQL setup script included in this project.</span></div><Link to="/admin">Open setup guide <ArrowRight size={14} /></Link></div>
}

function HomePage() {
  const [events, setEvents] = useState([])
  const [loading, setLoading] = useState(Boolean(supabase))
  const [error, setError] = useState('')
  useEffect(() => {
    let live = true
    if (!supabase) return
    supabase.from('events').select('id,name,slug,description,venue,city,starts_on,base_fee,currency,organization_id').eq('status', 'published').order('starts_on', { ascending: true }).then(({ data, error: e }) => {
      if (!live) return
      if (e) setError(e.message)
      setEvents(data || [])
      setLoading(false)
    })
    return () => { live = false }
  }, [])
  return <><SiteHeader /><SetupBanner /><main>
    <section className="hero wrap"><div className="hero-copy"><div className="eyebrow"><span className="pulse-dot" /> ONE PLATFORM. EVERY EVENT.</div><h1>Less paperwork.<br /><em>More event.</em></h1><p className="hero-lead">A simple, reusable event operations platform for marathons, sports meets, college fests, charity runs and community programmes.</p><div className="hero-actions"><Link className="btn btn-primary" to="/admin">Start managing events <ArrowRight size={17} /></Link><a className="btn btn-quiet" href="#how-it-works">See how it works</a></div><div className="hero-proof"><span><CheckCircle2 size={15} /> Registration</span><span><CheckCircle2 size={15} /> Payments</span><span><CheckCircle2 size={15} /> QR check-in</span></div></div><div className="hero-visual"><div className="visual-top"><span>LIVE EVENT OVERVIEW</span><span className="live-label"><i /> READY</span></div><div className="visual-title">Event operations<br /><strong>at a glance.</strong></div><div className="mini-stats"><div><Users size={17} /><b>Participants</b><strong>1,248</strong><small>Across all events</small></div><div><Wallet size={17} /><b>Payments</b><strong>₹2.4L</strong><small>Verified collection</small></div></div><div className="visual-chart"><div className="chart-head"><span>Registrations</span><small>ILLUSTRATIVE PREVIEW</small></div><div className="chart-bars">{[34,48,42,68,53,79,66,94,72,100,81,91].map((h, i) => <i key={i} style={{ height: `${h}%` }} />)}</div><div className="chart-foot"><span>WEEK 01</span><span>WEEK 04</span></div></div><div className="float-chip"><QrCode size={19} /><span><b>Fast check-in</b><small>Scan. Verify. Enter.</small></span><CheckCircle2 size={17} /></div></div></section>
    <section className="feature-strip wrap"><div><span className="feature-icon"><Ticket size={20} /></span><b>Public event pages</b><small>One shareable link for every event</small></div><div><span className="feature-icon"><Wallet size={20} /></span><b>Payment tracking</b><small>Review and verify payment proofs</small></div><div><span className="feature-icon"><QrCode size={20} /></span><b>Bib & QR check-in</b><small>Faster participant entry</small></div><div><span className="feature-icon"><ClipboardList size={20} /></span><b>Live admin dashboard</b><small>Reports, filters and CSV export</small></div></section>
    <section id="how-it-works" className="how-section wrap"><div className="section-heading"><div><div className="eyebrow">BUILT FOR ORGANISERS</div><h2>Everything in one workflow.</h2></div><p>Create a new event whenever you need one. Your platform, database and admin access stay in one place.</p></div><div className="steps-grid"><div className="step-card"><span>01</span><CalendarDays /><h3>Create an event</h3><p>Set event details, venue, categories, fees and payment instructions.</p></div><div className="step-card"><span>02</span><Users /><h3>Collect registrations</h3><p>Share a mobile-friendly page. Participants submit details and payment proof.</p></div><div className="step-card"><span>03</span><BadgeCheck /><h3>Verify & issue bibs</h3><p>Review payments, confirm participants and assign unique bib numbers.</p></div><div className="step-card"><span>04</span><QrCode /><h3>Check in & report</h3><p>Scan participant QR codes and export your event records.</p></div></div></section>
    <section className="events-section wrap"><div className="section-heading"><div><div className="eyebrow">PUBLIC EVENTS</div><h2>Find an upcoming event.</h2></div><span className="muted">Events published by organisers on EventFlow</span></div>{error && <Notice kind="error">Unable to load events: {error}</Notice>}{loading ? <div className="empty-state">Loading published events…</div> : events.length ? <div className="event-grid">{events.map(ev => <EventCard key={ev.id} event={ev} />)}</div> : <div className="empty-state"><CalendarDays size={26} /><b>No public events yet</b><span>When an organiser publishes an event, its registration page will appear here.</span><Link to="/admin" className="text-link">Create the first event <ArrowRight size={14} /></Link></div>}</section>
    <section className="closing-cta wrap"><div><div className="eyebrow">FOR EVENT ORGANISERS</div><h2>Make your next event easier to run.</h2><p>Bring registration, payment review, participants and event-day operations together.</p></div><Link className="btn btn-white" to="/admin">Open organiser workspace <ArrowRight size={17} /></Link></section>
  </main><Footer /></>
}

function EventCard({ event }) {
  return <Link to={`/e/${event.slug}`} className="event-card"><div className="event-card-top"><span className="event-pill">REGISTRATION OPEN</span><span className="card-arrow"><ArrowUpRightIcon /></span></div><h3>{event.name}</h3><p>{event.description || 'Join this event and complete your registration online.'}</p><div className="event-meta"><span><CalendarDays size={15} />{prettyDate(event.starts_on)}</span><span><MapPin size={15} />{[event.venue, event.city].filter(Boolean).join(', ') || 'Venue to be announced'}</span></div><div className="event-card-bottom"><b>From {money(event.base_fee, event.currency)}</b><span>View event <ArrowRight size={14} /></span></div></Link>
}
function ArrowUpRightIcon() { return <ExternalLink size={17} /> }

function EventPage() {
  const { slug } = useParams()
  const [event, setEvent] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(null)
  const [file, setFile] = useState(null)
  const [form, setForm] = useState({ full_name: '', email: '', phone: '', category: '', date_of_birth: '', emergency_contact: '', transaction_reference: '' })
  useEffect(() => {
    let live = true
    if (!supabase) { setLoading(false); setError('Connect the Supabase project to load this event.'); return }
    supabase.from('events').select('*').eq('slug', slug).eq('status', 'published').maybeSingle().then(({ data, error: e }) => {
      if (!live) return
      setEvent(data)
      setError(e?.message || (!data ? 'This event was not found or is not published.' : ''))
      const first = Array.isArray(data?.categories) ? data.categories[0]?.name : ''
      setForm(f => ({ ...f, category: first || '' }))
      setLoading(false)
    })
    return () => { live = false }
  }, [slug])
  const categories = Array.isArray(event?.categories) ? event.categories : []
  const chosen = categories.find(c => c.name === form.category)
  const fee = Number(chosen?.fee ?? event?.base_fee ?? 0)
  const setField = (key, value) => setForm(old => ({ ...old, [key]: value }))
  async function register(e) {
    e.preventDefault()
    setBusy(true); setError('')
    try {
      if (file && file.size > 5 * 1024 * 1024) throw new Error('Payment proof must be 5 MB or smaller.')
      const { data, error: rpcError } = await supabase.rpc('register_participant', {
        p_event_id: event.id,
        p_full_name: form.full_name.trim(),
        p_email: form.email.trim().toLowerCase(),
        p_phone: form.phone.trim(),
        p_category: form.category,
        p_date_of_birth: form.date_of_birth || null,
        p_emergency_contact: form.emergency_contact.trim() || null,
        p_transaction_reference: form.transaction_reference.trim() || null,
      })
      if (rpcError) throw rpcError
      let proofNotice = ''
      if (file) {
        try {
          const ext = (file.name.split('.').pop() || 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '')
          const path = `${event.id}/${data.registration_id}/${crypto.randomUUID()}.${ext}`
          const { error: uploadError } = await supabase.storage.from('payment-proofs').upload(path, file, { contentType: file.type || 'application/octet-stream', upsert: false })
          if (uploadError) throw uploadError
          const { error: attachError } = await supabase.rpc('attach_payment_proof', { p_registration_id: data.registration_id, p_object_path: path })
          if (attachError) throw attachError
        } catch (proofError) {
          proofNotice = ` Your registration was received, but the screenshot could not be uploaded (${proofError.message}). Please contact the organiser with your registration code.`
        }
      } else {
        proofNotice = ' You can share your payment proof with the organiser using the contact details in the event instructions.'
      }
      setDone({ ...data, proofNotice })
    } catch (err) { setError(err.message || 'Registration could not be completed.') }
    finally { setBusy(false) }
  }
  if (loading) return <><SiteHeader /><div className="page-loading">Loading event…</div></>
  if (done) return <><SiteHeader /><main className="wrap confirmation-wrap"><div className="confirmation-card"><div className="success-orb"><Check size={32} /></div><div className="eyebrow">REGISTRATION RECEIVED</div><h1>You're on the list.</h1><p>Your details have been submitted to the organiser. Keep this registration reference safe.</p><div className="confirm-code"><small>YOUR REGISTRATION CODE</small><strong>{done.registration_code}</strong><button className="btn btn-outline btn-small" onClick={() => navigator.clipboard?.writeText(done.registration_code)}>Copy code</button></div><div className="confirm-details"><span>Event <b>{event.name}</b></span><span>Category <b>{form.category}</b></span><span>Registration fee <b>{money(done.amount_due, event.currency)}</b></span></div><Notice kind="info">Payment status is pending until the event organiser verifies it.{done.proofNotice}</Notice><Link to="/" className="btn btn-primary">Back to EventFlow <ArrowRight size={16} /></Link></div></main><Footer /></>
  return <><SiteHeader /><main className="wrap event-page"><Link className="back-link" to="/"><ArrowLeft size={15} /> All events</Link>{error && <Notice kind="error">{error}</Notice>}{event && <div className="event-layout"><section className="event-detail"><span className="event-pill">ONLINE REGISTRATION</span><h1>{event.name}</h1><p className="event-description">{event.description || 'Register here to participate in this event.'}</p><div className="event-detail-meta"><div><CalendarDays /><span><small>EVENT DATE</small><b>{prettyDate(event.starts_on)}</b></span></div><div><MapPin /><span><small>VENUE</small><b>{[event.venue, event.city].filter(Boolean).join(', ') || 'To be announced'}</b></span></div></div><div className="event-info-panel"><h3>Categories & fees</h3>{categories.map(c => <div className="category-row" key={c.name}><span>{c.name}</span><b>{money(c.fee ?? event.base_fee, event.currency)}</b></div>)}{event.payment_instructions && <div className="payment-instructions"><b>Payment instructions</b><p>{event.payment_instructions}</p>{event.upi_id && <span className="upi-chip">UPI ID: {event.upi_id}</span>}</div>}</div><div className="privacy-note"><ShieldCheck size={17} /><span>Your registration details are shared only with this event's organiser and are not displayed to other participants.</span></div></section>
    <form className="registration-form" onSubmit={register}><div className="form-heading"><div><div className="eyebrow">PARTICIPANT FORM</div><h2>{event.registration_open ? 'Register now' : 'Registration closed'}</h2></div><span className="required-label">* Required</span></div>{!event.registration_open && <Notice kind="info">Registration for this event is currently closed. Please contact the organiser for more information.</Notice>}<label>Full name <em>*</em><input required maxLength="120" value={form.full_name} onChange={e => setField('full_name', e.target.value)} placeholder="Enter participant name" /></label><div className="form-row"><label>Email address <em>*</em><input type="email" required maxLength="180" value={form.email} onChange={e => setField('email', e.target.value)} placeholder="name@example.com" /></label><label>Mobile number <em>*</em><input type="tel" required maxLength="20" value={form.phone} onChange={e => setField('phone', e.target.value)} placeholder="10-digit mobile number" /></label></div><label>Event category <em>*</em><select required value={form.category} onChange={e => setField('category', e.target.value)}>{categories.map(c => <option key={c.name} value={c.name}>{c.name} — {money(c.fee ?? event.base_fee, event.currency)}</option>)}</select></label><div className="form-row"><label>Date of birth {(chosen?.minAge !== undefined || chosen?.maxAge !== undefined) && <em>*</em>}<input type="date" required={chosen?.minAge !== undefined || chosen?.maxAge !== undefined} value={form.date_of_birth} onChange={e => setField('date_of_birth', e.target.value)} /></label><label>Emergency contact<input type="tel" maxLength="20" value={form.emergency_contact} onChange={e => setField('emergency_contact', e.target.value)} placeholder="Optional" /></label></div><label>UPI / transaction reference<input maxLength="100" value={form.transaction_reference} onChange={e => setField('transaction_reference', e.target.value)} placeholder="Enter transaction ID after payment" /></label><label className="upload-box"><FileImage size={20} /><span><b>Payment screenshot</b><small>{file ? file.name : 'Optional · JPG, PNG, WEBP or PDF · max 5 MB'}</small></span><input type="file" accept="image/jpeg,image/png,image/webp,application/pdf" onChange={e => setFile(e.target.files?.[0] || null)} /></label><div className="fee-summary"><span>Registration fee</span><strong>{money(fee, event.currency)}</strong></div><label className="consent"><input type="checkbox" required /><span>I confirm that the details provided are correct and agree to the event organiser using them for registration and event communication.</span></label><Notice kind="error">{error}</Notice><button className="btn btn-primary btn-full" disabled={busy || !categories.length || !event.registration_open}>{busy ? 'Submitting registration…' : 'Submit registration'} <ArrowRight size={17} /></button><small className="form-footnote">Your registration will remain pending until the organiser verifies payment.</small></form></div>}</main><Footer /></>
}

function AuthPanel({ onAuthenticated }) {
  const [mode, setMode] = useState('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [kind, setKind] = useState('info')
  async function submit(e) {
    e.preventDefault(); setBusy(true); setMessage('')
    try {
      if (mode === 'signup') {
        const { data, error } = await supabase.auth.signUp({ email: email.trim(), password })
        if (error) throw error
        setKind('success')
        setMessage(data.session ? 'Account created. Your workspace is ready to set up.' : 'Account created. Check your email to confirm your address, then sign in.')
        if (data.session) onAuthenticated(data.session.user)
      } else {
        const { data, error } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
        if (error) throw error
        onAuthenticated(data.user)
      }
    } catch (e2) { setKind('error'); setMessage(e2.message) }
    finally { setBusy(false) }
  }
  return <div className="auth-card"><div className="auth-mark"><ShieldCheck size={22} /></div><div className="eyebrow">ORGANISER ACCESS</div><h1>{mode === 'signin' ? 'Welcome back.' : 'Create your workspace.'}</h1><p>{mode === 'signin' ? 'Sign in to manage events, participants and payments.' : 'Create an organiser account to start managing events.'}</p><form onSubmit={submit}><label>Email address<input type="email" required value={email} onChange={e => setEmail(e.target.value)} placeholder="you@organisation.org" /></label><label>Password<input type="password" required minLength="8" value={password} onChange={e => setPassword(e.target.value)} placeholder="At least 8 characters" /></label><Notice kind={kind}>{message}</Notice><button className="btn btn-primary btn-full" disabled={busy}>{busy ? 'Please wait…' : mode === 'signin' ? 'Sign in' : 'Create account'} <ArrowRight size={16} /></button></form><div className="auth-switch">{mode === 'signin' ? "New to EventFlow?" : 'Already have an account?'} <button onClick={() => { setMode(mode === 'signin' ? 'signup' : 'signin'); setMessage('') }}>{mode === 'signin' ? 'Create an account' : 'Sign in'}</button></div></div>
}

function AdminPage() {
  const [user, setUser] = useState(null)
  const [authLoading, setAuthLoading] = useState(true)
  useEffect(() => {
    if (!supabase) { setAuthLoading(false); return }
    supabase.auth.getSession().then(({ data }) => { setUser(data.session?.user || null); setAuthLoading(false) })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => setUser(session?.user || null))
    return () => subscription.unsubscribe()
  }, [])
  if (!isSupabaseConfigured) return <><SiteHeader admin /><SetupBanner /><main className="wrap setup-page"><div className="auth-card setup-card"><div className="auth-mark"><ShieldCheck size={22} /></div><div className="eyebrow">CONNECT YOUR BACKEND</div><h1>One-time setup.</h1><p>Connect this project to Supabase before creating an organiser account.</p><ol className="setup-list"><li>Create a Supabase project.</li><li>Open its SQL Editor and run <code>supabase/schema.sql</code>.</li><li>Copy the Project URL and publishable key into <code>.env.local</code>.</li><li>Restart the development server or redeploy on Vercel.</li></ol><a className="btn btn-primary btn-full" href="https://supabase.com/dashboard" target="_blank" rel="noreferrer">Open Supabase dashboard <ExternalLink size={16} /></a></div></main><Footer /></>
  if (authLoading) return <><SiteHeader admin /><div className="page-loading">Checking sign-in…</div></>
  return <><SiteHeader admin />{!user ? <main className="auth-page wrap"><div className="auth-side"><div className="eyebrow">EVENTFLOW WORKSPACE</div><h2>Run every event<br /><em>with clarity.</em></h2><p>Your private control centre for registrations, payment status, bib allocation and event-day check-ins.</p><div className="auth-side-points"><span><CheckCircle2 /> Your events stay separate</span><span><CheckCircle2 /> Role-controlled access</span><span><CheckCircle2 /> Export-ready participant data</span></div></div><AuthPanel onAuthenticated={setUser} /></main> : <Dashboard user={user} onSignOut={() => supabase.auth.signOut()} /> }<Footer /></>
}

function Dashboard({ user, onSignOut }) {
  const [org, setOrg] = useState(null)
  const [orgs, setOrgs] = useState([])
  const [selectedOrgId, setSelectedOrgId] = useState('')
  const [role, setRole] = useState('')
  const [events, setEvents] = useState([])
  const [activeEvent, setActiveEvent] = useState(null)
  const [registrations, setRegistrations] = useState([])
  const [teamMembers, setTeamMembers] = useState([])
  const [teamEmail, setTeamEmail] = useState('')
  const [teamRole, setTeamRole] = useState('staff')
  const [teamLoading, setTeamLoading] = useState(false)
  const [loading, setLoading] = useState(true)
  const [notice, setNotice] = useState(null)
  const [orgName, setOrgName] = useState('')
  const [showOrgForm, setShowOrgForm] = useState(false)
  const [showEventForm, setShowEventForm] = useState(false)
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('all')
  const [tab, setTab] = useState('participants')
  const [fundClaims, setFundClaims] = useState([])
  const [claimSummary, setClaimSummary] = useState(null)
  const [claimsLoading, setClaimsLoading] = useState(false)
  const [claimBusy, setClaimBusy] = useState(false)
  const [transferRefs, setTransferRefs] = useState({})
    const [newEvent, setNewEvent] = useState({ name: '', description: '', venue: '', city: '', starts_on: '', base_fee: '200', currency: 'INR', upi_id: '', payment_instructions: 'Pay using any UPI app and enter the transaction reference in the registration form.', categories: 'General|200' })
  const isAdmin = ['owner', 'admin'].includes(role)
  async function loadWorkspace(preferredOrgId = selectedOrgId) {
    setLoading(true)
    const { data: memberships, error } = await supabase.from('organization_members').select('organization_id, role').eq('user_id', user.id).order('created_at', { ascending: true })
    if (error) { setNotice({ kind: 'error', text: error.message }); setLoading(false); return }
    if (!memberships?.length) {
      setOrg(null); setOrgs([]); setSelectedOrgId(''); setRole(''); setEvents([]); setActiveEvent(null); setRegistrations([])
      setLoading(false); return
    }
    const ids = memberships.map(m => m.organization_id)
    const { data: organizations, error: orgError } = await supabase.from('organizations').select('*').in('id', ids).order('created_at', { ascending: true })
    if (orgError) { setNotice({ kind: 'error', text: orgError.message }); setLoading(false); return }
    const availableOrgs = (organizations || []).map(o => ({ ...o, role: memberships.find(m => m.organization_id === o.id)?.role || 'staff' }))
    const selected = availableOrgs.find(o => o.id === preferredOrgId) || availableOrgs[0]
    setOrgs(availableOrgs)
    setSelectedOrgId(selected.id)
    setOrg(selected)
    setRole(selected.role)
    const { data: eventRows, error: eventErr } = await supabase.from('events').select('*').eq('organization_id', selected.id).order('created_at', { ascending: false })
    if (eventErr) setNotice({ kind: 'error', text: eventErr.message })
    setEvents(eventRows || [])
    setActiveEvent(current => (eventRows || []).find(e => e.id === current?.id) || (eventRows || [])[0] || null)
    setRegistrations([])
    setTeamMembers([])
    setTab('participants')
    setLoading(false)
  }
  useEffect(() => { loadWorkspace() }, [user.id])
  async function loadRegistrations(event) {
    if (!event) { setRegistrations([]); return }
    const { data, error } = await supabase.from('registrations').select('*').eq('event_id', event.id).order('created_at', { ascending: false })
    if (error) setNotice({ kind: 'error', text: error.message })
    setRegistrations(data || [])
  }
  useEffect(() => { loadRegistrations(activeEvent) }, [activeEvent?.id])
  async function loadTeam() {
    if (!org) return
    setTeamLoading(true)
    const { data, error } = await supabase.from('organization_members').select('id,email,role,created_at').eq('organization_id', org.id).order('created_at', { ascending: true })
    if (error) setNotice({ kind: 'error', text: error.message })
    setTeamMembers(data || [])
    setTeamLoading(false)
  }
  useEffect(() => { if (tab === 'team') loadTeam() }, [tab, org?.id])
  async function loadFundClaims() {
    if (!org || !activeEvent || !isAdmin) return
    setClaimsLoading(true)
    const [claimsResult, summaryResult] = await Promise.all([
      supabase.from('fund_claims').select('*').eq('organization_id', org.id).order('requested_at', { ascending: false }),
      supabase.rpc('get_fund_claim_summary', { p_event_id: activeEvent.id }),
    ])
    if (claimsResult.error) setNotice({ kind: 'error', text: claimsResult.error.message })
    if (summaryResult.error) setNotice({ kind: 'error', text: summaryResult.error.message })
    setFundClaims(claimsResult.data || [])
    setClaimSummary(summaryResult.data || null)
    setClaimsLoading(false)
  }
  useEffect(() => { if (tab === 'fundclaims') loadFundClaims() }, [tab, org?.id, activeEvent?.id])
  async function requestFundClaim() {
    if (!activeEvent) return
    setClaimBusy(true)
    const { data, error } = await supabase.rpc('request_fund_claim', { p_event_id: activeEvent.id })
    if (error) setNotice({ kind: 'error', text: error.message })
    else setNotice({ kind: 'success', text: `Fund claim submitted. Gross ${money(data.gross_amount, data.currency)}, 5% deduction ${money(data.fee_amount, data.currency)}, net claim ${money(data.net_amount, data.currency)}.` })
    await loadFundClaims()
    setClaimBusy(false)
  }
  async function updateFundClaim(claim, status) {
    setClaimBusy(true)
    const { error } = await supabase.rpc('update_fund_claim', {
      p_claim_id: claim.id, p_status: status,
      p_cashfree_transfer_id: transferRefs[claim.id] || null,
      p_admin_note: null,
    })
    if (error) setNotice({ kind: 'error', text: error.message })
    else setNotice({ kind: 'success', text: status === 'paid' ? 'Claim marked paid and recorded.' : status === 'rejected' ? 'Claim rejected. Its funds are available to claim again.' : 'Claim marked as processing.' })
    await loadFundClaims()
    setClaimBusy(false)
  }
  async function addTeamMember(e) {
    e.preventDefault()
    const { error } = await supabase.rpc('add_organization_member', { p_organization_id: org.id, p_email: teamEmail.trim(), p_role: teamRole })
    if (error) setNotice({ kind: 'error', text: error.message })
    else { setNotice({ kind: 'success', text: `${teamEmail.trim()} added to the workspace.` }); setTeamEmail(''); await loadTeam() }
  }
  async function createOrg(e) {
    e.preventDefault()
    const { data, error } = await supabase.rpc('create_organization', { p_name: orgName.trim() })
    if (error) setNotice({ kind: 'error', text: error.message })
    else {
      setOrgName('')
      setShowOrgForm(false)
      setNotice({ kind: 'success', text: 'Organisation created. You are now its owner.' })
      await loadWorkspace(data)
    }
  }
  async function switchOrganisation(id) {
    if (!id || id === selectedOrgId) return
    await loadWorkspace(id)
  }
  async function createEvent(e) {
    e.preventDefault()
    const cats = newEvent.categories.split('\n').map(line => line.trim()).filter(Boolean).map(line => {
      const [name, fee, minAge, maxAge] = line.split('|')
      return { name: name?.trim(), fee: Number(fee || newEvent.base_fee), ...(minAge ? { minAge: Number(minAge) } : {}), ...(maxAge ? { maxAge: Number(maxAge) } : {}) }
    })
    if (!cats.length || cats.some(c => !c.name || Number.isNaN(c.fee) || c.fee < 0 || (c.minAge !== undefined && (!Number.isInteger(c.minAge) || c.minAge < 0)) || (c.maxAge !== undefined && (!Number.isInteger(c.maxAge) || c.maxAge < 0)) || (c.minAge !== undefined && c.maxAge !== undefined && c.maxAge < c.minAge))) { setNotice({ kind: 'error', text: 'Add categories per line: Category name|fee|minimum age|maximum age' }); return }
    const slug = slugify(newEvent.name)
    if (!slug) { setNotice({ kind: 'error', text: 'Enter an event name containing letters or numbers.' }); return }
    const { data, error } = await supabase.from('events').insert({
      organization_id: org.id, name: newEvent.name.trim(), slug, description: newEvent.description.trim(), venue: newEvent.venue.trim(), city: newEvent.city.trim(), starts_on: newEvent.starts_on || null,
      base_fee: Number(newEvent.base_fee || 0), currency: newEvent.currency, upi_id: newEvent.upi_id.trim() || null, payment_instructions: newEvent.payment_instructions.trim() || null,
      categories: cats, status: 'draft', registration_open: true,
    }).select().single()
    if (error) setNotice({ kind: 'error', text: error.message })
    else { setEvents(prev => [data, ...prev]); setActiveEvent(data); setShowEventForm(false); setNotice({ kind: 'success', text: 'Event created as a draft. Publish it when you are ready to accept registrations.' }); setNewEvent({ name: '', description: '', venue: '', city: '', starts_on: '', base_fee: '200', currency: 'INR', upi_id: '', payment_instructions: 'Pay using any UPI app and enter the transaction reference in the registration form.', categories: 'General|200' }) }
  }
  async function togglePublish(event) {
    const next = event.status === 'published' ? 'draft' : 'published'
    const { data, error } = await supabase.from('events').update({ status: next }).eq('id', event.id).select().single()
    if (error) setNotice({ kind: 'error', text: error.message })
    else { setEvents(prev => prev.map(e => e.id === event.id ? data : e)); if (activeEvent?.id === event.id) setActiveEvent(data); setNotice({ kind: 'success', text: next === 'published' ? 'Event published. Share its registration link.' : 'Event moved back to draft.' }) }
  }
  async function toggleRegistration(event) {
    const { data, error } = await supabase.from('events').update({ registration_open: !event.registration_open }).eq('id', event.id).select().single()
    if (error) setNotice({ kind: 'error', text: error.message })
    else { setEvents(prev => prev.map(e => e.id === event.id ? data : e)); if (activeEvent?.id === event.id) setActiveEvent(data); setNotice({ kind: 'success', text: data.registration_open ? 'Registrations reopened.' : 'Registrations closed. The event page remains visible.' }) }
  }
  async function paymentAction(row, action) {
    const fn = action === 'approve' ? 'approve_registration' : 'reject_registration'
    const { error } = await supabase.rpc(fn, { p_registration_id: row.id })
    if (error) setNotice({ kind: 'error', text: error.message })
    else { setNotice({ kind: 'success', text: action === 'approve' ? `Payment verified. Bib number assigned to ${row.full_name}.` : `Registration rejected for ${row.full_name}.` }); await loadRegistrations(activeEvent) }
  }
  async function checkIn(code) {
    const { data, error } = await supabase.rpc('check_in_registration', { p_registration_code: code.trim() })
    if (error) setNotice({ kind: 'error', text: error.message })
    else { setNotice({ kind: 'success', text: `${data.full_name} checked in · Bib ${data.bib_number}` }); await loadRegistrations(activeEvent) }
  }
  async function openProof(row) {
    if (!row.proof_path) { setNotice({ kind: 'info', text: 'No payment screenshot was uploaded for this registration.' }); return }
    const { data, error } = await supabase.storage.from('payment-proofs').createSignedUrl(row.proof_path, 60)
    if (error) setNotice({ kind: 'error', text: error.message })
    else window.open(data.signedUrl, '_blank', 'noopener,noreferrer')
  }
  function exportCsv() {
    const rows = filteredRows
    const headers = ['Registration code','Name','Email','Phone','Category','Amount','Payment status','Registration status','Bib number','Checked in','Created at']
    const values = rows.map(r => [r.registration_code,r.full_name,r.email,r.phone,r.category,r.amount_due,r.payment_status,r.status,r.bib_number ?? '',r.checked_in_at ? 'Yes' : 'No',r.created_at])
    const csv = [headers, ...values].map(row => row.map(v => `"${String(v ?? '').replaceAll('"','""')}"`).join(',')).join('\r\n')
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }))
    const a = document.createElement('a'); a.href = url; a.download = `${activeEvent?.slug || 'event'}-participants.csv`; a.click(); URL.revokeObjectURL(url)
  }
  const filteredRows = useMemo(() => registrations.filter(r => {
    const matchesSearch = [r.full_name,r.email,r.phone,r.registration_code,String(r.bib_number || '')].join(' ').toLowerCase().includes(search.toLowerCase())
    const matchesFilter = filter === 'all' || r.payment_status === filter || (filter === 'checked_in' && Boolean(r.checked_in_at))
    return matchesSearch && matchesFilter
  }), [registrations, search, filter])
  const stats = useMemo(() => ({ total: registrations.length, pending: registrations.filter(r => r.payment_status === 'pending').length, confirmed: registrations.filter(r => r.status === 'confirmed').length, checked: registrations.filter(r => r.checked_in_at).length, amount: registrations.filter(r => r.payment_status === 'verified').reduce((s, r) => s + Number(r.amount_due || 0), 0) }), [registrations])
  if (loading) return <div className="page-loading">Loading your workspace…</div>
  if (!org) return <main className="wrap setup-page"><form className="auth-card" onSubmit={createOrg}><div className="auth-mark"><Zap size={22} /></div><div className="eyebrow">FIRST-TIME SETUP</div><h1>Create your organiser workspace.</h1><p>This workspace keeps your organisation's events and participant records separate from other organisers.</p><label>Organisation / brand name<input required maxLength="100" value={orgName} onChange={e => setOrgName(e.target.value)} placeholder="e.g. Natura’s Trust" /></label><Notice kind={notice?.kind}>{notice?.text}</Notice><button className="btn btn-primary btn-full">Create workspace <ArrowRight size={16} /></button><p className="tiny-note">Signed in as {user.email}. You will become the workspace owner.</p></form></main>
  return <main className="admin-shell wrap"><aside className="admin-sidebar"><div className="workspace-brand"><div className="workspace-avatar">{org.name.slice(0,1).toUpperCase()}</div><div className="workspace-identity"><b>{org.name}</b><small>ORGANISER WORKSPACE</small></div></div><label className="org-switcher-label">YOUR ORGANISATIONS<select className="org-switcher" value={selectedOrgId} onChange={e => switchOrganisation(e.target.value)}>{orgs.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label><button className="btn btn-outline btn-small side-create" onClick={() => { setShowOrgForm(v => !v); setOrgName('') }}><Plus size={15} /> Add organisation</button><div className="sidebar-section">WORKSPACE</div><button className="side-link active"><LayoutDashboard size={17} /> Overview</button><div className="sidebar-section">YOUR EVENTS <button title="Create event" onClick={() => setShowEventForm(true)}><Plus size={14} /></button></div><div className="side-event-list">{events.map(ev => <button className={`side-event ${activeEvent?.id === ev.id ? 'selected' : ''}`} key={ev.id} onClick={() => { setActiveEvent(ev); setTab('participants') }}><span className="side-event-dot" /> <span>{ev.name}</span><small className={`status-dot ${ev.status}`} /></button>)}</div><button className="btn btn-outline btn-small side-create" onClick={() => setShowEventForm(v => !v)}><Plus size={15} /> New event</button><div className="sidebar-bottom"><div className="account-mini"><span className="account-avatar">{user.email?.slice(0,1).toUpperCase()}</span><span><b>{user.email}</b><small>{role}</small></span></div><button className="side-link signout" onClick={onSignOut}><LogOut size={16} /> Sign out</button></div></aside>
  <section className="admin-main"><div className="admin-topline"><div><div className="eyebrow">EVENT OPERATIONS / OVERVIEW</div><h1>Good to see you.</h1><p>Manage registrations, payments and event-day check-ins from one place.</p></div><div className="admin-top-actions"><span className="secure-chip"><ShieldCheck size={14} /> Secure workspace</span><button className="icon-btn" onClick={() => { loadWorkspace(); loadRegistrations(activeEvent) }} title="Refresh"><RefreshCw size={17} /></button></div></div>
    {notice && <Notice kind={notice.kind} onClose={() => setNotice(null)}>{notice.text}</Notice>}
    {showOrgForm && <form className="create-event-panel" onSubmit={createOrg}><div className="panel-heading"><div><div className="eyebrow">NEW ORGANISATION</div><h2>Create another organisation</h2></div><button type="button" className="icon-btn" onClick={() => setShowOrgForm(false)}><X size={18} /></button></div><div className="form-grid"><label className="span-2">Organisation / brand name <em>*</em><input required maxLength="100" value={orgName} onChange={e => setOrgName(e.target.value)} placeholder="e.g. Natura’s Trust" /></label></div><div className="panel-footer"><span>You will become the owner of this organisation. Its events and team remain separate.</span><button className="btn btn-primary" type="submit">Create organisation <ArrowRight size={16} /></button></div></form>}
    {showEventForm && <form className="create-event-panel" onSubmit={createEvent}><div className="panel-heading"><div><div className="eyebrow">NEW EVENT</div><h2>Create an event page</h2></div><button type="button" className="icon-btn" onClick={() => setShowEventForm(false)}><X size={18} /></button></div><div className="form-grid"><label>Event name <em>*</em><input required value={newEvent.name} onChange={e => setNewEvent(v => ({ ...v, name: e.target.value }))} placeholder="e.g. City Charity Run 2027" /></label><label>Event date<input type="date" value={newEvent.starts_on} onChange={e => setNewEvent(v => ({ ...v, starts_on: e.target.value }))} /></label><label>Venue<input value={newEvent.venue} onChange={e => setNewEvent(v => ({ ...v, venue: e.target.value }))} placeholder="Ground / stadium / location" /></label><label>City<input value={newEvent.city} onChange={e => setNewEvent(v => ({ ...v, city: e.target.value }))} placeholder="City, district" /></label><label>Base fee<input type="number" min="0" value={newEvent.base_fee} onChange={e => setNewEvent(v => ({ ...v, base_fee: e.target.value }))} /></label><label>Currency<select value={newEvent.currency} onChange={e => setNewEvent(v => ({ ...v, currency: e.target.value }))}><option value="INR">INR — Indian Rupee</option><option value="USD">USD — US Dollar</option></select></label><label>UPI ID<input value={newEvent.upi_id} onChange={e => setNewEvent(v => ({ ...v, upi_id: e.target.value }))} placeholder="name@bank" /></label><label>Categories & fees <small>Name|Fee|Minimum age|Maximum age — one per line</small><textarea required rows="3" value={newEvent.categories} onChange={e => setNewEvent(v => ({ ...v, categories: e.target.value }))} placeholder={'5 KM|200|7|15\n10 KM|300|16|99'} /></label><label className="span-2">Short event description<textarea rows="2" value={newEvent.description} onChange={e => setNewEvent(v => ({ ...v, description: e.target.value }))} placeholder="Tell participants what this event is about" /></label><label className="span-2">Payment instructions<textarea rows="2" value={newEvent.payment_instructions} onChange={e => setNewEvent(v => ({ ...v, payment_instructions: e.target.value }))} /></label></div><div className="panel-footer"><span>New events start as drafts. You choose when to publish.</span><button className="btn btn-primary" type="submit">Create draft event <ArrowRight size={16} /></button></div></form>}
    {events.length === 0 && !showEventForm ? <div className="empty-state large"><CalendarDays size={30} /><b>Your first event starts here.</b><span>Create an event page, configure categories and fees, then publish it when you're ready.</span><button className="btn btn-primary" onClick={() => setShowEventForm(true)}><Plus size={16} /> Create your first event</button></div> : activeEvent && <>
      <div className="active-event-bar"><div><span className={`status-badge ${activeEvent.status}`}>{activeEvent.status}</span><h2>{activeEvent.name}</h2><div className="active-event-meta"><span><CalendarDays size={14} /> {prettyDate(activeEvent.starts_on)}</span><span><MapPin size={14} /> {[activeEvent.venue, activeEvent.city].filter(Boolean).join(', ') || 'Venue not set'}</span></div></div><div className="event-actions"><button className="btn btn-outline btn-small" onClick={() => navigator.clipboard?.writeText(`${window.location.origin}/e/${activeEvent.slug}`)}><ExternalLink size={15} /> Copy registration link</button>{isAdmin && <><button className="btn btn-outline btn-small" onClick={() => toggleRegistration(activeEvent)}>{activeEvent.registration_open ? 'Close registrations' : 'Reopen registrations'}</button><button className={`btn btn-small ${activeEvent.status === 'published' ? 'btn-danger-outline' : 'btn-primary'}`} onClick={() => togglePublish(activeEvent)}>{activeEvent.status === 'published' ? 'Unpublish' : 'Publish event'} <ArrowRight size={15} /></button></>}</div></div>
      <div className="stats-grid"><StatCard icon={<Users />} label="Total registrations" value={stats.total} detail="All submitted participants" /><StatCard icon={<Clock3 />} label="Awaiting verification" value={stats.pending} detail="Payment review required" /><StatCard icon={<BadgeCheck />} label="Confirmed participants" value={stats.confirmed} detail="Payment verified" /><StatCard icon={<Wallet />} label="Verified collection" value={money(stats.amount, activeEvent.currency)} detail="Based on verified payments" /></div>
      <div className="dashboard-tabs"><button className={tab === 'participants' ? 'active' : ''} onClick={() => setTab('participants')}><Users size={16} /> Participants</button><button className={tab === 'checkin' ? 'active' : ''} onClick={() => setTab('checkin')}><QrCode size={16} /> Event-day check-in</button><button className={tab === 'event' ? 'active' : ''} onClick={() => setTab('event')}><Globe2 size={16} /> Event page</button>{isAdmin && <button className={tab === 'team' ? 'active' : ''} onClick={() => setTab('team')}><Users size={16} /> Team</button>}{isAdmin && <button className={tab === 'fundclaims' ? 'active' : ''} onClick={() => setTab('fundclaims')}><Wallet size={16} /> Fund claims</button>}</div>
      {tab === 'participants' && <section className="data-panel"><div className="data-panel-head"><div><h3>Participant registrations</h3><p>Review payment status, confirm entries and manage bib numbers.</p></div><button className="btn btn-outline btn-small" onClick={exportCsv}><Download size={15} /> Export CSV</button></div><div className="table-controls"><div className="search-field"><Search size={16} /><input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search name, phone, email, bib…" /></div><select value={filter} onChange={e => setFilter(e.target.value)}><option value="all">All registrations</option><option value="pending">Payment pending</option><option value="verified">Payment verified</option><option value="rejected">Rejected</option><option value="checked_in">Checked in</option></select></div>{filteredRows.length ? <div className="table-scroll"><table><thead><tr><th>PARTICIPANT</th><th>CATEGORY</th><th>AMOUNT</th><th>PAYMENT</th><th>BIB / ENTRY</th><th>PROOF</th><th>ACTIONS</th></tr></thead><tbody>{filteredRows.map(row => <tr key={row.id}><td><div className="participant-cell"><b>{row.full_name}</b><small>{row.email}</small><small>{row.phone}</small><small className="code-text">{row.registration_code}</small></div></td><td>{row.category}</td><td><b>{money(row.amount_due, activeEvent.currency)}</b></td><td><span className={`status-badge ${row.payment_status}`}>{row.payment_status}</span></td><td>{row.bib_number ? <span className="bib-chip">#{row.bib_number}</span> : <span className="muted">—</span>}{row.checked_in_at && <small className="checked-label"><CheckCircle2 size={12} /> Checked in</small>}</td><td><button className="proof-link" onClick={() => openProof(row)}><FileImage size={14} /> {row.proof_path ? 'View proof' : 'No file'}</button></td><td><div className="row-actions">{row.payment_status === 'pending' && isAdmin && <><button className="approve-btn" title="Verify payment" onClick={() => paymentAction(row, 'approve')}><Check size={15} /></button><button className="reject-btn" title="Reject registration" onClick={() => paymentAction(row, 'reject')}><X size={15} /></button></>}{row.status === 'confirmed' && <QRCodeSVG value={row.registration_code} size={42} level="M" />}</div></td></tr>)}</tbody></table></div> : <div className="table-empty"><Users size={24} /><b>No matching registrations</b><span>Participant entries will appear here when someone submits the public event form.</span></div>}</section>}
      {tab === 'checkin' && <CheckinPanel event={activeEvent} registrations={registrations} onScan={checkIn} />}
      {tab === 'event' && <div className="event-share-panel"><div className="event-share-text"><div className="eyebrow">PUBLIC REGISTRATION PAGE</div><h3>Share your event with participants.</h3><p>Anyone with this link can view the published event and submit a registration. Draft events are not publicly accessible.</p><div className="share-url">{window.location.origin}/e/{activeEvent.slug}</div><button className="btn btn-primary" onClick={() => navigator.clipboard?.writeText(`${window.location.origin}/e/${activeEvent.slug}`)}>Copy event link <ExternalLink size={15} /></button></div><div className="share-qr"><QRCodeSVG value={`${window.location.origin}/e/${activeEvent.slug}`} size={156} level="H" /><small>SCAN TO REGISTER</small></div></div>}{tab === 'team' && <TeamPanel members={teamMembers} loading={teamLoading} email={teamEmail} setEmail={setTeamEmail} role={teamRole} setRole={setTeamRole} onSubmit={addTeamMember} />}{tab === 'fundclaims' && <FundClaimsPanel event={activeEvent} events={events} claims={fundClaims} summary={claimSummary} loading={claimsLoading} busy={claimBusy} transferRefs={transferRefs} setTransferRefs={setTransferRefs} onClaim={requestFundClaim} onUpdate={updateFundClaim} />}
    </>}
    <div className="admin-footer-note"><ShieldCheck size={15} /> Each organiser can access only their own workspace data. Keep your login secure.</div>
  </section>
  </main>
}

function FundClaimsPanel({ event, events, claims, summary, loading, busy, transferRefs, setTransferRefs, onClaim, onUpdate }) {
  return <section className="data-panel fund-claims-panel">
    <div className="data-panel-head"><div><h3>Fund claims & payouts</h3><p>Cashfree payments become claimable after 48 hours. A 5% deduction is applied to each claim.</p></div><span className="secure-chip"><ShieldCheck size={14} /> Admin only</span></div>
    {event && <div className="claim-summary-card"><div><small>AVAILABLE TO CLAIM · {event.name}</small><strong>{money(summary?.eligible_gross, event.currency)}</strong><span>Gross eligible funds</span></div><div className="claim-breakdown"><span>5% deduction <b>{money(summary?.fee_amount, event.currency)}</b></span><span>Net payout <b>{money(summary?.net_amount, event.currency)}</b></span></div><button className="btn btn-primary" disabled={busy || loading || !summary?.claimable} onClick={onClaim}>{busy ? 'Please wait…' : 'Claim available funds'} <ArrowRight size={16} /></button><small className="claim-footnote">Only successful Cashfree payments at least 48 hours old are included. Pending and processing claims reserve their funds.</small></div>}
    {loading ? <div className="table-empty">Loading claims…</div> : claims.length ? <div className="claim-list"><h4>Claim requests</h4>{claims.map(claim => { const eventName = events.find(e => e.id === claim.event_id)?.name || 'Event'; return <article className="claim-card" key={claim.id}><div className="claim-card-head"><div><b>{eventName}</b><small>{new Date(claim.requested_at).toLocaleString('en-IN')}</small></div><span className={`status-badge ${claim.status}`}>{claim.status}</span></div><div className="claim-amounts"><span>Gross <b>{money(claim.gross_amount, claim.currency)}</b></span><span>5% fee <b>−{money(claim.fee_amount, claim.currency)}</b></span><span>Net payout <b>{money(claim.net_amount, claim.currency)}</b></span></div>{claim.cashfree_transfer_id && <small className="claim-reference">Cashfree transfer reference: {claim.cashfree_transfer_id}</small>}{claim.admin_note && <small className="claim-reference">Note: {claim.admin_note}</small>}{claim.status === 'pending' && <div className="claim-actions"><button className="btn btn-outline btn-small" disabled={busy} onClick={() => onUpdate(claim,'processing')}>Mark processing</button><button className="btn btn-danger-outline btn-small" disabled={busy} onClick={() => onUpdate(claim,'rejected')}>Reject</button></div>}{claim.status === 'processing' && <div className="claim-actions"><label>Cashfree payout / transfer reference<input value={transferRefs[claim.id] || ''} onChange={e => setTransferRefs(old => ({ ...old, [claim.id]: e.target.value }))} placeholder="Enter transfer ID" /></label><button className="btn btn-primary btn-small" disabled={busy || !(transferRefs[claim.id] || '').trim()} onClick={() => onUpdate(claim,'paid')}>Mark paid</button><button className="btn btn-danger-outline btn-small" disabled={busy} onClick={() => onUpdate(claim,'rejected')}>Reject</button></div>}</article>})}</div> : <div className="table-empty"><Wallet size={24} /><b>No fund claims yet</b><span>Claim requests will appear here after an organiser requests eligible funds.</span></div>}
  </section>
}

function StatCard({ icon, label, value, detail }) { return <div className="stat-card"><span className="stat-icon">{icon}</span><span className="stat-label">{label}</span><strong>{value}</strong><small>{detail}</small></div> }
function TeamPanel({ members, loading, email, setEmail, role, setRole, onSubmit }) {
  return <section className="team-layout"><div className="team-invite-panel"><div className="eyebrow">WORKSPACE ACCESS</div><h3>Add an organiser to your team.</h3><p>They must create and confirm their own EventFlow account first. Add their account email here to grant access to this organisation.</p><form onSubmit={onSubmit}><label>Account email<input type="email" required value={email} onChange={e => setEmail(e.target.value)} placeholder="organiser@example.com" /></label><label>Access role<select value={role} onChange={e => setRole(e.target.value)}><option value="staff">Staff — view participants & check-in</option><option value="admin">Admin — manage events & verify payments</option></select></label><button className="btn btn-primary"><Plus size={16} /> Add team member</button></form></div><div className="team-list-panel"><div className="data-panel-head"><div><h3>Workspace members</h3><p>People who can access this organisation's data.</p></div><span className="secure-chip"><ShieldCheck size={13} /> Private</span></div>{loading ? <div className="table-empty">Loading team…</div> : members.map(member => <div className="team-member" key={member.id}><span className="account-avatar">{member.email.slice(0,1).toUpperCase()}</span><span><b>{member.email}</b><small>{member.role}</small></span><span className="status-badge confirmed">{member.role === 'owner' ? 'OWNER' : member.role.toUpperCase()}</span></div>)}</div></section>
}

function CheckinPanel({ event, registrations, onScan }) {
  const [code, setCode] = useState('')
  const [manualBusy, setManualBusy] = useState(false)
  const [scan, setScan] = useState(false)
  const ready = registrations.filter(r => r.status === 'confirmed' && !r.checked_in_at)
  const checked = registrations.filter(r => r.checked_in_at)
  async function manual(e) { e.preventDefault(); setManualBusy(true); await onScan(code); setCode(''); setManualBusy(false) }
  return <section className="checkin-layout"><div className="checkin-main"><div className="checkin-intro"><div className="scanner-icon"><QrCode size={29} /></div><div><h3>Fast participant check-in</h3><p>Scan the QR on a participant's confirmation pass, or enter their registration code manually.</p></div></div><button className="btn btn-primary" onClick={() => setScan(v => !v)}><QrCode size={17} /> {scan ? 'Close scanner' : 'Open camera scanner'}</button>{scan && <Scanner onScan={async value => { await onScan(value); setScan(false) }} />}<form className="manual-checkin" onSubmit={manual}><label>Registration code<input required value={code} onChange={e => setCode(e.target.value)} placeholder="e.g. EVT-8F20A1D9C4" /></label><button className="btn btn-outline" disabled={manualBusy}>{manualBusy ? 'Checking…' : 'Check in'}</button></form></div><div className="checkin-side"><div><span>WAITING TO ARRIVE</span><strong>{ready.length}</strong><small>Confirmed participants</small></div><div><span>ALREADY CHECKED IN</span><strong>{checked.length}</strong><small>Successful event entries</small></div></div></section>
}
function Scanner({ onScan }) {
  const readerId = useMemo(() => `qr-reader-${Math.random().toString(36).slice(2)}`, [])
  const instance = useRef(null)
  const [error, setError] = useState('')
  useEffect(() => {
    let disposed = false
    const scanner = new Html5Qrcode(readerId)
    instance.current = scanner
    scanner.start({ facingMode: 'environment' }, { fps: 10, qrbox: { width: 230, height: 230 }, aspectRatio: 1 }, async decoded => {
      try { await scanner.stop() } catch { /* scanner may already be stopped */ }
      if (!disposed) onScan(decoded)
    }, () => {}).then(() => {
      if (disposed && scanner.isScanning) scanner.stop().catch(() => {})
    }).catch(e => { if (!disposed) setError(e.message || 'Camera could not start. Check browser camera permission.') })
    return () => { disposed = true; if (scanner.isScanning) scanner.stop().catch(() => {}) }
  }, [readerId])
  return <div className="scanner-box"><div id={readerId} /><small>Point your phone camera at the participant's EventFlow QR code.</small>{error && <Notice kind="error">{error}</Notice>}</div>
}

function Footer() { return <footer className="footer wrap"><Link className="brand" to="/"><span className="brand-mark"><Activity size={17} /></span><span>event<span className="brand-light">flow</span></span></Link><span>Reusable event registration & operations platform.</span><span><Link to="/contact">Contact</Link> · <Link to="/terms">Terms</Link> · <Link to="/refunds">Refunds</Link> · <Link to="/services">Services & pricing</Link></span></footer> }

export default function App() {
  return <Routes><Route path="/" element={<HomePage />} /><Route path="/e/:slug" element={<EventPage />} /><Route path="/admin" element={<AdminPage />} /><Route path="/contact" element={<ContactPage />} /><Route path="/terms" element={<TermsPage />} /><Route path="/refunds" element={<RefundsPage />} /><Route path="/services" element={<ServicesPage />} /><Route path="*" element={<NotFound />} /></Routes>
}
function NotFound() { return <><SiteHeader /><main className="wrap empty-page"><div className="empty-state"><XCircle size={28} /><b>Page not found</b><Link className="text-link" to="/">Return home <ArrowRight size={14} /></Link></div></main><Footer /></> }
