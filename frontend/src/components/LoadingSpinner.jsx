/**
 * LoadingSpinner — full-page centred spinner for dark Midnight theme.
 */
export default function LoadingSpinner({ message = 'Loading…' }) {
  return (
    <div className="min-h-dvh flex flex-col items-center justify-center bg-night-900 gap-4">
      <div className="relative w-10 h-10">
        <div className="absolute inset-0 rounded-full border-2 border-night-600" />
        <div className="absolute inset-0 rounded-full border-2 border-vivid-500 border-t-transparent animate-spin" />
      </div>
      <p className="text-xs text-night-300 animate-pulse-soft tracking-widest uppercase">{message}</p>
    </div>
  );
}
