import Link from "next/link";

export default function NotFound() {
  return (
    <main className="flex min-h-screen items-center justify-center px-6 py-16">
      <div className="mx-auto max-w-xl text-center">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-yellow-400">
          404
        </p>
        <h1 className="mt-4 text-4xl font-bold text-white">Page not found</h1>
        <p className="mt-4 text-base text-slate-300">
          The page you requested does not exist or is no longer available.
        </p>
        <div className="mt-8 flex items-center justify-center gap-4">
          <Link
            href="/"
            className="rounded-md bg-yellow-400 px-4 py-2 text-sm font-semibold text-slate-900 transition hover:bg-yellow-300"
          >
            Go home
          </Link>
          <Link
            href="/entity-browser"
            className="rounded-md border border-slate-600 px-4 py-2 text-sm font-semibold text-white transition hover:border-slate-400 hover:bg-slate-800"
          >
            Browse entities
          </Link>
        </div>
      </div>
    </main>
  );
}
