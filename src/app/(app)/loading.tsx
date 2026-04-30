export default function AppLoading() {
  return (
    <div className="space-y-4">
      <div className="space-y-3">
        <div className="h-8 w-48 animate-pulse rounded-2xl bg-[#dfe7ee]" />
        <div className="h-5 w-full animate-pulse rounded-2xl bg-[#e8eef4]" />
        <div className="h-5 w-3/4 animate-pulse rounded-2xl bg-[#e8eef4]" />
      </div>

      <div className="space-y-4">
        <div className="h-36 animate-pulse rounded-[28px] bg-white shadow-[0_12px_28px_rgba(20,27,33,0.06)]" />
        <div className="h-32 animate-pulse rounded-[28px] bg-white shadow-[0_12px_28px_rgba(20,27,33,0.06)]" />
        <div className="h-32 animate-pulse rounded-[28px] bg-white shadow-[0_12px_28px_rgba(20,27,33,0.06)]" />
      </div>
    </div>
  );
}
