import AnimatedLogo from "@/components/AnimatedLogo";

export default function Loading() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center bg-[var(--bg)] px-4">
      <div className="flex flex-col items-center justify-center gap-4 text-center">
        <AnimatedLogo size={120} />
        <div className="space-y-1">
          <p className="font-heading text-2xl text-[#2d2d2d]">Legart</p>
          <p className="text-sm text-[#5f5a52]">Loading your puzzle studio…</p>
        </div>
      </div>
    </div>
  );
}
