import { PageSkeleton } from "@/app/skeleton";

export default function Loading() {
  return <PageSkeleton variant="rows" cards={7} />;
}
