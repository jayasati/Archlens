import { SkeletonCard } from '@/components/shared/loading-skeleton';

export default function Loading() {
  return (
    <div className="space-y-6">
      <SkeletonCard className="h-72" lines={3} />
      <SkeletonCard lines={6} />
    </div>
  );
}
