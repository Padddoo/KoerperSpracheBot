import { cn } from "@/lib/utils";

export function RobotAvatar({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 48 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={cn("h-9 w-9 shrink-0", className)}
      aria-hidden="true"
    >
      {/* Antenne */}
      <line
        x1="24"
        y1="14"
        x2="24"
        y2="7"
        stroke="#141414"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <circle cx="24" cy="6" r="2.5" fill="#FF6B35" stroke="#141414" strokeWidth="1.5" />
      {/* Ohren */}
      <rect x="5" y="22" width="4" height="8" rx="1.5" fill="#94A3B8" stroke="#141414" strokeWidth="1.5" />
      <rect x="39" y="22" width="4" height="8" rx="1.5" fill="#94A3B8" stroke="#141414" strokeWidth="1.5" />
      {/* Kopf */}
      <rect
        x="9"
        y="14"
        width="30"
        height="24"
        rx="5"
        fill="#CCFBF1"
        stroke="#141414"
        strokeWidth="2"
      />
      {/* Augen */}
      <circle cx="18" cy="24" r="2.4" fill="#141414" />
      <circle cx="30" cy="24" r="2.4" fill="#141414" />
      <circle cx="18.8" cy="23.2" r="0.8" fill="#fff" />
      <circle cx="30.8" cy="23.2" r="0.8" fill="#fff" />
      {/* Mund */}
      <path
        d="M17 31 Q24 34 31 31"
        stroke="#141414"
        strokeWidth="2"
        strokeLinecap="round"
        fill="none"
      />
      {/* Schraube links */}
      <circle cx="13" cy="19" r="1" fill="#141414" />
      {/* Schraube rechts */}
      <circle cx="35" cy="19" r="1" fill="#141414" />
    </svg>
  );
}
