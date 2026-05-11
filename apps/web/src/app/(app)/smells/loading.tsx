import { Skeleton, SkeletonCard } from '@/components/shared/loading-skeleton';

export default function Loading() {
  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <Skeleton className="h-7 w-40" />
        <Skeleton className="h-4 w-96" />
      </div>
      <div className="space-y-4">
        <Skeleton className="h-4 w-24" />
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {Array.from({ length: 4 }, (_, i) => (
            <SkeletonCard key={i} className="h-44" lines={4} />
          ))}
        </div>
      </div>
    </div>
  );
}
