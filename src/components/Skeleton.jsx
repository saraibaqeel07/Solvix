export function Skeleton({ className = '' }) {
  return <div className={`skeleton ${className}`} />;
}

export function StatCardSkeleton() {
  return (
    <div className="card p-6">
      <div className="flex items-start justify-between mb-4">
        <Skeleton className="h-12 w-12 rounded-xl" />
        <Skeleton className="h-6 w-16 rounded-full" />
      </div>
      <Skeleton className="h-8 w-20 mb-2" />
      <Skeleton className="h-4 w-32" />
    </div>
  );
}

export function ChartSkeleton() {
  return (
    <div className="card">
      <div className="card-header">
        <Skeleton className="h-5 w-40" />
        <Skeleton className="h-4 w-24" />
      </div>
      <div className="card-body">
        <Skeleton className="h-56 w-full rounded-xl" />
      </div>
    </div>
  );
}

export function TableSkeleton({ rows = 5 }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex gap-4 items-center">
          <Skeleton className="h-4 flex-1" />
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-4 w-16" />
        </div>
      ))}
    </div>
  );
}
