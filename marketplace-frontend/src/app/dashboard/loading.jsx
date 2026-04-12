export default function DashboardLoading() {
  return (
    <div className="space-y-8">
      <div className="space-y-1">
        <div className="h-7 w-40 bg-gray-800 rounded animate-pulse" />
        <div className="h-4 w-64 bg-gray-800 rounded animate-pulse" />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
        {[1, 2, 3].map((i) => (
          <div key={i} className="card animate-pulse space-y-3">
            <div className="aspect-[3/2] rounded-lg bg-gray-800" />
            <div className="h-4 bg-gray-800 rounded w-3/4" />
            <div className="h-3 bg-gray-800 rounded w-1/2" />
            <div className="h-9 bg-gray-800 rounded" />
          </div>
        ))}
      </div>
    </div>
  );
}
