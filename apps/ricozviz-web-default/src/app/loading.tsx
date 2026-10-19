export default function Loading() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#121212]">
      <div className="flex flex-col items-center gap-4">
        {/* Spinner */}
        <div className="h-10 w-10 animate-spin rounded-full border-2 border-[#262626] border-t-[#ff6b35]" />
        <p className="text-xs font-mono-code text-[#888888]">Loading RicozViz Engine...</p>
      </div>
    </div>
  );
}
