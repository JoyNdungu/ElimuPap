import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Navbar from '../components/Navbar';

const FEATURES = [
  {
    id: 'feat-library',
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" />
      </svg>
    ),
    title: 'Curated Library',
    description: 'Access a meticulously assembled collection of resources. Quality over quantity, ensuring every text serves a specific, elevated purpose.',
  },
  {
    id: 'feat-courses',
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M4.26 10.147a60.436 60.436 0 00-.491 6.347A48.627 48.627 0 0112 20.904a48.627 48.627 0 018.232-4.41 60.46 60.46 0 00-.491-6.347m-15.482 0a50.57 50.57 0 00-2.658-.813A59.905 59.905 0 0112 3.493a59.902 59.902 0 0110.399 5.84c-.896.248-1.783.52-2.658.814m-15.482 0A50.697 50.697 0 0112 13.489a50.702 50.702 0 017.74-3.342M6.75 15a.75.75 0 100-1.5.75.75 0 000 1.5zm0 0v-3.675A55.378 55.378 0 0112 8.443m-7.007 11.55A5.981 5.981 0 006.75 15.75v-1.5" />
      </svg>
    ),
    title: 'Expert Courses',
    description: 'Engage with curriculums crafted by leading minds. Structured to challenge and refine your understanding through rigorous, focused modules.',
  },
  {
    id: 'feat-methodology',
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25H12" />
      </svg>
    ),
    title: 'Structured Methodology',
    description: 'Experience learning devoid of digital noise. Our platform acts as a quiet scaffolding, supporting your intellectual architecture.',
  },
];

export default function LandingPage() {
  const { isAuthenticated } = useAuth();

  return (
    <div className="min-h-dvh flex flex-col font-sans" style={{ backgroundColor: '#13131f', color: '#ffffff' }}>
      <Navbar />

      {/* ── Hero: 2-col on desktop ── */}
      <section className="w-full max-w-[1200px] mx-auto px-6 lg:px-8 pt-16 pb-24" aria-labelledby="hero-heading">
        <div className="flex flex-col lg:flex-row items-center justify-between gap-12">

          {/* Left */}
          <div className="flex-1 max-w-[480px] animate-slide-up">
            {/* Label */}
            <p className="text-[10px] font-bold uppercase tracking-[0.1em] mb-4"
              style={{ color: '#4F46E5' }}>
              A NEW STANDARD
            </p>

            {/* Heading */}
            <h1 id="hero-heading"
              className="font-display text-[#ffffff] mb-6"
              style={{ fontSize: '48px', lineHeight: '1.05', letterSpacing: '-0.02em' }}>
              Elevate your<br />learning journey
            </h1>

            {/* Description */}
            <p className="text-[14px] leading-[1.6] mb-8"
              style={{ color: '#d1d5db', maxWidth: '400px' }}>
              Discover a digital space designed with quiet intention. We believe education should inspire clarity, not distraction. Experience a refined methodology tailored for the discerning mind.
            </p>

            {/* CTAs */}
            <div className="flex flex-wrap gap-4">
              <Link
                to={isAuthenticated ? '/dashboard' : '/register'}
                className="inline-flex items-center justify-center text-[13px] px-6 py-2.5 rounded-md transition-colors"
                style={{ backgroundColor: '#5046E5', color: '#ffffff', fontWeight: 500 }}
                onMouseEnter={e => e.currentTarget.style.backgroundColor = '#4338ca'}
                onMouseLeave={e => e.currentTarget.style.backgroundColor = '#5046E5'}
              >
                {isAuthenticated ? 'Dashboard' : 'Get Started'}
              </Link>
              <Link
                to="/login"
                className="inline-flex items-center justify-center text-[13px] px-6 py-2.5 rounded-md transition-colors"
                style={{ border: '1px solid rgba(255,255,255,0.1)', color: '#d1d5db', backgroundColor: 'transparent', fontWeight: 500 }}
                onMouseEnter={e => { e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.05)'; e.currentTarget.style.color = '#fff'; }}
                onMouseLeave={e => { e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.color = '#d1d5db'; }}
              >
                Explore Methodology
              </Link>
            </div>
          </div>

          {/* Right — Tablet image */}
          <div className="flex-1 w-full max-w-[600px] animate-fade-in flex justify-end">
             <div className="w-full relative rounded-[16px] overflow-hidden shadow-2xl" style={{ paddingTop: '65%', backgroundColor: '#1a1a2e' }}>
                <img 
                  src="/@fs/C:/Users/hp/.gemini/antigravity-ide/brain/637aa257-4162-4df1-8726-fb7e0cd6aa65/app_hero_mockup_1787861450902.jpg" 
                  alt="Tablet Dashboard" 
                  className="absolute inset-0 w-full h-full object-cover"
                  style={{ filter: 'contrast(1.05)' }}
                />
             </div>
          </div>
        </div>
      </section>


      {/* ── Precision in Education (Features) ── */}
      <section id="features" className="w-full" style={{ backgroundColor: '#13131f', borderTop: '1px solid rgba(255,255,255,0.03)' }} aria-labelledby="precision-heading">
        <div className="max-w-[1200px] mx-auto px-6 lg:px-8 py-20">
          <div className="text-center mb-14">
            <h2 id="precision-heading"
              className="font-display text-[#ffffff] mb-3"
              style={{ fontSize: '28px' }}>
              Precision in Education
            </h2>
            <p className="text-[13px] leading-relaxed mx-auto" style={{ color: '#9ca3af', maxWidth: '520px' }}>
              Our architecture is built on three pillars of excellence, designed to foster deep work and
              sustained intellectual growth.
            </p>
          </div>

          {/* 3-column feature cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {FEATURES.map((feature, i) => (
              <div
                key={feature.id}
                className="rounded-xl p-8 flex flex-col animate-slide-up hover:-translate-y-1 transition-transform duration-300"
                style={{
                  backgroundColor: '#1a1a2e',
                  border: '1px solid rgba(255,255,255,0.02)',
                  animationDelay: `${i * 100}ms`,
                }}
              >
                {/* Icon box */}
                <div
                  className="flex items-center justify-center rounded-[8px] mb-5"
                  style={{ width: 40, height: 40, backgroundColor: '#2d2d4a', color: '#9ca3af' }}
                >
                  {feature.icon}
                </div>
                <div>
                  <h3 className="text-[15px] font-semibold text-[#ffffff] mb-2">{feature.title}</h3>
                  <p className="text-[13px] leading-[1.6]" style={{ color: '#9ca3af' }}>{feature.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── How it Works ── */}
      <section id="how-it-works" className="w-full" style={{ backgroundColor: '#17171F', borderTop: '1px solid rgba(255,255,255,0.03)' }} aria-labelledby="how-it-works-heading">
        <div className="max-w-[1200px] mx-auto px-6 lg:px-8 py-20">
          <div className="text-center mb-16">
            <p className="text-[10px] font-bold uppercase tracking-[0.1em] mb-3" style={{ color: '#5B57FF' }}>SIMPLIFIED WORKFLOW</p>
            <h2 id="how-it-works-heading"
              className="font-display text-[#ffffff] mb-3"
              style={{ fontSize: '28px' }}>
              How ElimuPap Works
            </h2>
            <p className="text-[13px] leading-relaxed mx-auto" style={{ color: '#9ca3af', maxWidth: '520px' }}>
              Transform your raw study materials into an actionable, personalized learning plan in just three simple steps.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 relative">
            {/* Connecting Line (desktop only) */}
            <div className="hidden md:block absolute top-6 left-[15%] right-[15%] h-px" style={{ backgroundColor: 'rgba(255,255,255,0.05)' }}></div>

            {/* Step 1 */}
            <div className="relative text-center animate-slide-up">
              <div className="mx-auto w-12 h-12 rounded-full flex items-center justify-center font-display text-lg mb-6 relative z-10" style={{ backgroundColor: '#1F1F2A', border: '1px solid #5B57FF', color: '#5B57FF' }}>1</div>
              <h3 className="text-[16px] font-semibold text-white mb-2">Upload Materials</h3>
              <p className="text-[13px] leading-[1.6] mx-auto" style={{ color: '#9ca3af', maxWidth: '280px' }}>
                Easily upload your lecture slides, PDFs, or typed notes directly to your secure digital library.
              </p>
            </div>

            {/* Step 2 */}
            <div className="relative text-center animate-slide-up" style={{ animationDelay: '100ms' }}>
              <div className="mx-auto w-12 h-12 rounded-full flex items-center justify-center font-display text-lg mb-6 relative z-10" style={{ backgroundColor: '#1F1F2A', border: '1px solid #5B57FF', color: '#5B57FF' }}>2</div>
              <h3 className="text-[16px] font-semibold text-white mb-2">AI Processing</h3>
              <p className="text-[13px] leading-[1.6] mx-auto" style={{ color: '#9ca3af', maxWidth: '280px' }}>
                Our assistant instantly analyzes your files to generate concise summaries, flashcards, and custom quizzes.
              </p>
            </div>

            {/* Step 3 */}
            <div className="relative text-center animate-slide-up" style={{ animationDelay: '200ms' }}>
              <div className="mx-auto w-12 h-12 rounded-full flex items-center justify-center font-display text-lg mb-6 relative z-10" style={{ backgroundColor: '#1F1F2A', border: '1px solid #5B57FF', color: '#5B57FF' }}>3</div>
              <h3 className="text-[16px] font-semibold text-white mb-2">Master the Material</h3>
              <p className="text-[13px] leading-[1.6] mx-auto" style={{ color: '#9ca3af', maxWidth: '280px' }}>
                Follow your personalized study plan, take quizzes, and track your mastery directly on the dashboard.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── CTA Banner ── */}
      <section className="w-full" style={{ backgroundColor: '#1a1a2e' }} aria-labelledby="cta-heading">
        <div className="max-w-[1200px] mx-auto px-6 lg:px-8 py-24 text-center">
          <h2 id="cta-heading"
            className="font-display text-[#ffffff] mb-4"
            style={{ fontSize: '36px', letterSpacing: '-0.01em' }}>
            Begin your journey today
          </h2>
          <p className="text-[14px] leading-relaxed mb-8 mx-auto" style={{ color: '#9ca3af', maxWidth: '440px' }}>
            Join a community of professionals committed to purposeful learning. Step into a space
            designed for clarity and focus.
          </p>
          <Link
            to={isAuthenticated ? '/dashboard' : '/register'}
            className="inline-flex items-center justify-center text-[13px] px-6 py-2.5 rounded-md transition-colors"
            style={{ backgroundColor: '#5046E5', color: '#ffffff', fontWeight: 500 }}
            onMouseEnter={e => e.currentTarget.style.backgroundColor = '#4338ca'}
            onMouseLeave={e => e.currentTarget.style.backgroundColor = '#5046E5'}
          >
            {isAuthenticated ? 'Open Dashboard' : 'Create your account'}
          </Link>
        </div>
      </section>


      {/* ── Footer ── */}
      <footer className="w-full" style={{ backgroundColor: '#13131f' }}>
        <div className="max-w-[1200px] mx-auto px-6 lg:px-8 py-10 flex flex-col md:flex-row items-center justify-between gap-6">
          <span className="font-display text-[#ffffff] text-[20px]">ElimuPap</span>
          <div className="flex items-center gap-8 text-[10px] uppercase tracking-wider font-semibold" style={{ color: '#9ca3af' }}>
            <a href="#" className="hover:text-white transition-colors">Privacy Policy</a>
            <a href="#" className="hover:text-white transition-colors">Terms of Service</a>
            <a href="#" className="hover:text-white transition-colors">Contact</a>
          </div>
          <p className="text-[10px] font-semibold" style={{ color: '#6b7280' }}>
            © 2024 ElimuPap AI. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}
