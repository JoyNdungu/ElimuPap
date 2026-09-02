export default function EmptyState({ icon, title, description, action }) {
  return (
    <div className="flex flex-col items-center justify-center py-14 px-6 text-center animate-fade-in">
      {icon && <div className="text-4xl mb-4 select-none" aria-hidden="true">{icon}</div>}
      <h3 className="text-sm font-semibold text-night-100 mb-2">{title}</h3>
      {description && <p className="text-xs text-night-400 max-w-xs leading-relaxed">{description}</p>}
      {action && (
        <button onClick={action.onClick} className="btn btn-primary btn-md mt-6" id="empty-state-cta">
          {action.label}
        </button>
      )}
    </div>
  );
}
