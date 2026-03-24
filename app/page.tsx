export default function Home() {
  return (
    <div className="flex min-h-[calc(100dvh-3.5rem)] flex-col items-center justify-center gap-8 bg-zinc-950 p-8 text-zinc-100">
      <div className="text-center space-y-2">
        <h1 className="text-4xl font-semibold tracking-tight">This or That</h1>
        <p className="text-zinc-400 max-w-md">
          Pairwise choices from your Pinterest boards — share a link, collect preferences.
        </p>
      </div>
      <div className="flex flex-wrap gap-4 justify-center">
        <a
          href="/admin"
          className="rounded-full bg-white text-zinc-900 px-6 py-3 font-medium hover:bg-zinc-200 transition-colors"
        >
          Admin
        </a>
      </div>
    </div>
  );
}
