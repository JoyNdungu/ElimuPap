import Sidebar from '../components/Sidebar';

function StubPage({ icon, title, description }) {
  return (
    <div className="flex min-h-dvh font-sans" style={{ backgroundColor: '#17171F' }}>
      <Sidebar />
      <div className="flex-1 pb-24 lg:pb-0 flex items-center justify-center px-6">
        <div className="text-center max-w-md animate-slide-up">
          <div className="text-[4rem] mb-8 select-none flex justify-center">
            <div className="w-24 h-24 rounded-full flex items-center justify-center shadow-2xl" style={{ backgroundColor: '#1F1F2A', border: '1px solid rgba(255,255,255,0.03)' }}>
              {icon}
            </div>
          </div>
          <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full uppercase tracking-[0.15em] mb-6 text-[11px] font-bold"
            style={{ backgroundColor: 'rgba(91,87,255,0.1)', border: '1px solid rgba(91,87,255,0.2)', color: '#7571ff' }}>
            <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ backgroundColor: '#7571ff' }} />
            Coming Soon
          </span>
          <h1 className="font-display text-[2.5rem] text-white leading-none mb-4 tracking-tight">
            {title}
          </h1>
          <p className="text-[15px] leading-relaxed" style={{ color: '#9ca3af' }}>
            {description}
          </p>
        </div>
      </div>
    </div>
  );
}

export function UploadNotesPage() {
  return <StubPage icon="" title="Upload Notes"
    description="Upload PDF, DOCX, or PPT files. Add unit name, code, and topic — ElimuPap extracts text and powers your AI features." />;
}
export function NotesPage() {
  return <StubPage icon="" title="My Notes"
    description="Browse, search, and manage all your uploaded lecture notes organised by unit and topic." />;
}
export function SummaryPage() {
  return <StubPage icon="" title="AI Summary"
    description="View AI-generated summaries, key points, important definitions, and revision questions for your notes." />;
}
export function TutorPage() {
  return <StubPage icon="🤖" title="ElimuPap Tutor"
    description="Chat with your personalized AI assistant, grounded in your uploaded notes." />;
}
export function QuizPage() {
  return <StubPage icon="" title="Quizzes"
    description="Take spaced-repetition quizzes generated from your notes. The system prioritises topics you struggle with most." />;
}
