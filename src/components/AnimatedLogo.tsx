"use client";

import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

interface AnimatedLogoProps {
  size?: number;
  className?: string;
}

export default function AnimatedLogo({
  size = 120,
  className = "",
}: AnimatedLogoProps) {
  const [animate, setAnimate] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    setAnimate(false);
    const timer = window.setTimeout(() => setAnimate(true), 50);
    return () => window.clearTimeout(timer);
  }, [pathname]);

  return (
    <div
      className={`logo-wrapper ${className}`}
      style={{ width: size, height: size }}
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 200 200"
        width={size}
        height={size}
        className={animate ? "logo-animate" : ""}
      >
        {/* Background */}
        <rect
          x="8"
          y="8"
          width="184"
          height="184"
          rx="16"
          ry="16"
          fill="#1a1a2e"
        />
        <rect
          x="16"
          y="16"
          width="168"
          height="168"
          rx="8"
          ry="8"
          fill="none"
          stroke="#4a4a6a"
          strokeWidth="4"
        />

        {/* ===== TOP-LEFT (Red) ===== */}
        <g className="piece piece-tl">
          <path
            d="M36 36 h56 v20 c0 8 8 12 16 12 s16-4 16-12 v20 h-20 c-8 0-12 8-12 16 s4 16 12 16 h20 v20 h-56 c-8 0-12-8-12-16 s4-16 12-16 v-20 h20 c8 0 12-8 12-16 s-4-16-12-16 h-20 z"
            fill="#e63946"
          />
          <circle className="stud" cx="52" cy="52" r="7" fill="#ff6b6b" />
          <circle className="stud" cx="76" cy="52" r="7" fill="#ff6b6b" />
          <circle className="stud" cx="52" cy="76" r="7" fill="#ff6b6b" />
          <circle className="stud" cx="76" cy="76" r="7" fill="#ff6b6b" />
          <rect
            x="40"
            y="40"
            width="8"
            height="4"
            fill="#ff8e8e"
            opacity="0.7"
          />
        </g>

        {/* ===== TOP-RIGHT (Blue) ===== */}
        <g className="piece piece-tr">
          <path
            d="M108 36 h56 c8 0 12 8 12 16 s-4 16-12 16 v20 h-20 c-8 0-12 8-12 16 s4 16 12 16 h20 v20 h-56 v-20 c0-8 8-12 16-12 s16 4 16 12 v-20 h20 c8 0 12-8 12-16 s-4-16-12-16 h-20 v-20 z"
            fill="#457b9d"
          />
          <circle className="stud" cx="124" cy="52" r="7" fill="#5c9ead" />
          <circle className="stud" cx="148" cy="52" r="7" fill="#5c9ead" />
          <circle className="stud" cx="124" cy="76" r="7" fill="#5c9ead" />
          <circle className="stud" cx="148" cy="76" r="7" fill="#5c9ead" />
          <rect
            x="112"
            y="40"
            width="8"
            height="4"
            fill="#7eb8c9"
            opacity="0.7"
          />
        </g>

        {/* ===== BOTTOM-LEFT (Yellow) ===== */}
        <g className="piece piece-bl">
          <path
            d="M36 108 h56 v20 c0 8 8 12 16 12 s16-4 16-12 v20 h-20 c-8 0-12 8-12 16 s4 16 12 16 h20 v20 h-56 c-8 0-12-8-12-16 s4-16 12-16 v-20 h20 c8 0 12-8 12-16 s-4-16-12-16 h-20 z"
            fill="#f4a261"
          />
          <circle className="stud" cx="52" cy="124" r="7" fill="#f7c59f" />
          <circle className="stud" cx="76" cy="124" r="7" fill="#f7c59f" />
          <circle className="stud" cx="52" cy="148" r="7" fill="#f7c59f" />
          <circle className="stud" cx="76" cy="148" r="7" fill="#f7c59f" />
          <rect
            x="40"
            y="112"
            width="8"
            height="4"
            fill="#f9d5b5"
            opacity="0.7"
          />
        </g>

        {/* ===== BOTTOM-RIGHT (Green) ===== */}
        <g className="piece piece-br">
          <path
            d="M108 108 h56 c8 0 12 8 12 16 s-4 16-12 16 v20 h-20 c-8 0-12 8-12 16 s4 16 12 16 h20 v20 h-56 v-20 c0-8 8-12 16-12 s16 4 16 12 v-20 h20 c8 0 12-8 12-16 s-4-16-12-16 h-20 v-20 z"
            fill="#2a9d8f"
          />
          <circle className="stud" cx="124" cy="124" r="7" fill="#40b3a2" />
          <circle className="stud" cx="148" cy="124" r="7" fill="#40b3a2" />
          <circle className="stud" cx="124" cy="148" r="7" fill="#40b3a2" />
          <circle className="stud" cx="148" cy="148" r="7" fill="#40b3a2" />
          <rect
            x="112"
            y="112"
            width="8"
            height="4"
            fill="#5ec4b5"
            opacity="0.7"
          />
        </g>

        {/* Center pixel core */}
        <g className="core">
          <rect x="88" y="88" width="10" height="10" fill="#e9c46a" />
          <rect x="100" y="88" width="10" height="10" fill="#f4a261" />
          <rect x="88" y="100" width="10" height="10" fill="#e76f51" />
          <rect x="100" y="100" width="10" height="10" fill="#e9c46a" />
          <rect x="90" y="90" width="3" height="3" fill="#ffe08a" />
          <rect x="102" y="90" width="3" height="3" fill="#ffc08a" />
        </g>

        {/* Connection dots */}
        <circle
          className="dot"
          cx="100"
          cy="36"
          r="3"
          fill="#ffffff"
          opacity="0.4"
        />
        <circle
          className="dot"
          cx="164"
          cy="100"
          r="3"
          fill="#ffffff"
          opacity="0.4"
        />
        <circle
          className="dot"
          cx="100"
          cy="164"
          r="3"
          fill="#ffffff"
          opacity="0.4"
        />
        <circle
          className="dot"
          cx="36"
          cy="100"
          r="3"
          fill="#ffffff"
          opacity="0.4"
        />
      </svg>

      <style jsx>{`
        .logo-wrapper {
          display: inline-block;
          line-height: 0;
        }

        /* ===== Initial state (trước khi animate) ===== */
        .piece {
          opacity: 0;
          transform-origin: center;
        }
        .piece-tl {
          transform: translate(-40px, -40px) rotate(-25deg) scale(0.6);
        }
        .piece-tr {
          transform: translate(40px, -40px) rotate(25deg) scale(0.6);
        }
        .piece-bl {
          transform: translate(-40px, 40px) rotate(25deg) scale(0.6);
        }
        .piece-br {
          transform: translate(40px, 40px) rotate(-25deg) scale(0.6);
        }
        .stud {
          opacity: 0;
          transform: scale(0);
          transform-origin: center;
        }
        .core {
          opacity: 0;
          transform: scale(0);
          transform-origin: center;
        }
        .dot {
          opacity: 0;
        }

        /* ===== Animation khi có class logo-animate ===== */
        .logo-animate .piece-tl {
          animation: assembleTL 0.7s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
        }
        .logo-animate .piece-tr {
          animation: assembleTR 0.7s cubic-bezier(0.34, 1.56, 0.64, 1) 0.08s
            forwards;
        }
        .logo-animate .piece-bl {
          animation: assembleBL 0.7s cubic-bezier(0.34, 1.56, 0.64, 1) 0.16s
            forwards;
        }
        .logo-animate .piece-br {
          animation: assembleBR 0.7s cubic-bezier(0.34, 1.56, 0.64, 1) 0.24s
            forwards;
        }

        .logo-animate .stud {
          animation: popStud 0.4s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
        }
        .logo-animate .piece-tl .stud {
          animation-delay: 0.55s;
        }
        .logo-animate .piece-tr .stud {
          animation-delay: 0.63s;
        }
        .logo-animate .piece-bl .stud {
          animation-delay: 0.71s;
        }
        .logo-animate .piece-br .stud {
          animation-delay: 0.79s;
        }

        .logo-animate .core {
          animation: popCore 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) 0.9s
            forwards;
        }

        .logo-animate .dot {
          animation: fadeDot 0.4s ease 1.1s forwards;
        }

        /* Keyframes */
        @keyframes assembleTL {
          to {
            opacity: 1;
            transform: translate(0, 0) rotate(0deg) scale(1);
          }
        }
        @keyframes assembleTR {
          to {
            opacity: 1;
            transform: translate(0, 0) rotate(0deg) scale(1);
          }
        }
        @keyframes assembleBL {
          to {
            opacity: 1;
            transform: translate(0, 0) rotate(0deg) scale(1);
          }
        }
        @keyframes assembleBR {
          to {
            opacity: 1;
            transform: translate(0, 0) rotate(0deg) scale(1);
          }
        }
        @keyframes popStud {
          0% {
            opacity: 0;
            transform: scale(0);
          }
          70% {
            transform: scale(1.25);
          }
          100% {
            opacity: 1;
            transform: scale(1);
          }
        }
        @keyframes popCore {
          0% {
            opacity: 0;
            transform: scale(0);
          }
          70% {
            transform: scale(1.3);
          }
          100% {
            opacity: 1;
            transform: scale(1);
          }
        }
        @keyframes fadeDot {
          to {
            opacity: 0.4;
          }
        }
      `}</style>
    </div>
  );
}
