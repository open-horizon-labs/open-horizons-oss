const appVersion = process.env.NEXT_PUBLIC_APP_VERSION || '0.1.0'

export function Footer() {
  return (
    <footer className="border-t bg-white/80 backdrop-blur mt-auto">
      <div className="container mx-auto max-w-5xl px-4 h-10 flex items-center justify-between text-xs text-gray-400">
        <div className="flex items-center gap-3">
          <a
            href="https://github.com/open-horizon-labs/open-horizons-oss"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-gray-600 transition-colors"
          >
            Open Horizons
          </a>
          <span className="hidden sm:inline">v{appVersion}</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="hidden sm:inline text-gray-300">Enterprise edition available</span>
          <span>&copy; 2026 Open Horizon Labs. MIT License.</span>
        </div>
      </div>
    </footer>
  )
}
