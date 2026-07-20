export default function Loading() {
  return (
    <div className="grid gap-4">
      <div className="h-8 w-56 animate-pulse rounded-md bg-[#d9e1ea]" />
      <div className="grid gap-3 md:grid-cols-3">
        <div className="h-28 animate-pulse rounded-md bg-[#e7edf3]" />
        <div className="h-28 animate-pulse rounded-md bg-[#e7edf3]" />
        <div className="h-28 animate-pulse rounded-md bg-[#e7edf3]" />
      </div>
      <div className="h-72 animate-pulse rounded-md bg-[#e7edf3]" />
    </div>
  );
}
