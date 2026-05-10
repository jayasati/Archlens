import { Skeleton, SkeletonCard } from '@/components/shared/loading-skeleton';

export default function Loading() {
  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <Skeleton className="h-10 w-28" />
      </div>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <SkeletonCard className="h-44" />
        <SkeletonCard className="h-44 lg:col-span-2" />
      </div>
      <div className="grid grid-cols-2 gap-4 md:grid-cols-5">
        {Array.from({ length: 5 }, (_, i) => (
          <SkeletonCard key={i} className="h-24" lines={1} />
        ))}
      </div>
      <SkeletonCard lines={6} />
    </div>
  );
}
