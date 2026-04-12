export default function AdminLoading() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="flex items-center justify-between">
        <div className="h-7 w-32 bg-gray-800 rounded" />
        <div className="h-4 w-48 bg-gray-800 rounded" />
      </div>
      <div className="flex gap-1 border-b border-gray-800 pb-0">
        {[80, 64, 72, 56].map((w, i) => (
          <div key={i} className={`h-9 w-${w} bg-gray-800 rounded-t-lg`} />
        ))}
      </div>
      <div className="rounded-xl border border-gray-800 overflow-hidden">
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="flex gap-4 px-4 py-3 border-b border-gray-800">
            <div className="h-4 bg-gray-800 rounded flex-1" />
            <div className="h-4 bg-gray-800 rounded w-16" />
            <div className="h-4 bg-gray-800 rounded w-24" />
            <div className="h-4 bg-gray-800 rounded w-12" />
          </div>
        ))}
      </div>
    </div>
  );
}
