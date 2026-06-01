// Persistent attribution footer shown on every view.
export function PoweredBy() {
  return (
    <footer className="shrink-0 border-t border-neutral-900 bg-neutral-950 px-6 py-1.5 text-center">
      <a
        href="https://zeroperson.ai"
        target="_blank"
        rel="noopener noreferrer"
        className="text-[10px] tracking-wide text-neutral-600 hover:text-neutral-300 transition-colors"
      >
        Built by ZeroPerson LLC — zeroperson.ai
      </a>
    </footer>
  );
}
