function SkeletonCard({ legs = 3 }: { legs?: number }) {
  return (
    <article className="bg-card rounded-card border border-white/[0.06] p-4 space-y-3">
      <div className="flex justify-between gap-4">
        <div className="skeleton h-5 w-28" />
        <div className="flex flex-col items-end gap-1">
          <div className="skeleton h-7 w-16" />
          <div className="skeleton h-3 w-20" />
        </div>
      </div>
      {Array.from({ length: legs }).map((_, i) => (
        <div key={i} className="flex gap-3 items-center">
          <div className="skeleton w-8 h-8 rounded-full shrink-0" />
          <div className="flex-1 space-y-2">
            <div className="skeleton h-3.5 w-4/5" />
            <div className="skeleton h-3 w-1/2" />
          </div>
          <div className="skeleton h-5 w-14" />
        </div>
      ))}
      <div className="skeleton h-10 w-full rounded-lg mt-1" />
    </article>
  );
}

export function LoadingSkeleton() {
  return (
    <div className="px-4 pt-4 pb-24 space-y-4 max-w-phone mx-auto w-full min-h-full bg-page">
      <div className="skeleton h-8 w-32" />
      <div className="skeleton h-4 w-full max-w-[240px]" />
      <SkeletonCard legs={5} />
      <SkeletonCard legs={3} />
    </div>
  );
}