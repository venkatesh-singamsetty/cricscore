import React, { useId } from "react";

/**
 * Inline SVG cricket icons.
 *
 * Emoji glyphs (🏏 / 🎾) are rendered by each OS font, so on Android the
 * "ball" showed up as a tennis ball and the "bat" varied from vendor to vendor.
 * These SVGs render identically on iOS, Android, desktop and every browser engine.
 */
interface CricketIconProps {
  /** Extra classes. Size defaults to 1em so the icon scales with surrounding text. */
  className?: string;
  /** Accessible label (defaults to the icon name). */
  title?: string;
}

const BASE = "inline-block shrink-0 align-[-0.15em] w-[1em] h-[1em]";

/** Modern willow cricket bat: shaded blade, ridge, rubber grip with bands. */
export const BatIcon: React.FC<CricketIconProps> = ({
  className = "",
  title = "Bat",
}) => {
  const uid = useId().replace(/:/g, "");
  const wood = `bat-wood-${uid}`;
  const grip = `bat-grip-${uid}`;
  return (
    <svg
      viewBox="0 0 24 24"
      role="img"
      aria-label={title}
      data-testid="cricket-bat-icon"
      className={`${BASE} ${className}`}
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <linearGradient id={wood} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#f6d58f" />
          <stop offset="0.45" stopColor="#e9b25a" />
          <stop offset="1" stopColor="#b9772d" />
        </linearGradient>
        <linearGradient id={grip} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#1e293b" />
          <stop offset="1" stopColor="#0f172a" />
        </linearGradient>
      </defs>
      <g transform="rotate(45 12 12)">
        {/* Handle */}
        <rect
          x="10.55"
          y="0.6"
          width="2.9"
          height="8.2"
          rx="1.45"
          fill={`url(#${grip})`}
        />
        <rect
          x="10.55"
          y="2.3"
          width="2.9"
          height="0.8"
          fill="#e2e8f0"
          opacity="0.85"
        />
        <rect
          x="10.55"
          y="4.3"
          width="2.9"
          height="0.8"
          fill="#e2e8f0"
          opacity="0.85"
        />
        <rect
          x="10.55"
          y="6.3"
          width="2.9"
          height="0.8"
          fill="#e2e8f0"
          opacity="0.85"
        />
        {/* Shoulders + blade */}
        <path
          d="M10.7 8.6h2.6l1.9 2.1v9.4c0 1.5-1.2 2.7-2.7 2.7h-1.5c-1.5 0-2.7-1.2-2.7-2.7v-9.4z"
          fill={`url(#${wood})`}
          stroke="#8a5a1d"
          strokeWidth="0.7"
          strokeLinejoin="round"
        />
        {/* Ridge + edge highlight */}
        <path
          d="M12 10.4v11.2"
          stroke="#b9772d"
          strokeWidth="0.6"
          opacity="0.7"
        />
        <path
          d="M9.6 11.6v8"
          stroke="#fff7e0"
          strokeWidth="0.7"
          strokeLinecap="round"
          opacity="0.7"
        />
        {/* Toe guard */}
        <path
          d="M9.2 21.6h5.6"
          stroke="#8a5a1d"
          strokeWidth="0.6"
          opacity="0.6"
        />
      </g>
    </svg>
  );
};

/** Red leather cricket ball with raised white-stitched seam and gloss. */
export const BallIcon: React.FC<CricketIconProps> = ({
  className = "",
  title = "Ball",
}) => {
  const uid = useId().replace(/:/g, "");
  const shade = `ball-shade-${uid}`;
  return (
    <svg
      viewBox="0 0 24 24"
      role="img"
      aria-label={title}
      data-testid="cricket-ball-icon"
      className={`${BASE} ${className}`}
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <radialGradient id={shade} cx="0.35" cy="0.3" r="0.8">
          <stop offset="0" stopColor="#fca5a5" stopOpacity="0.9" />
          <stop offset="0.45" stopColor="#dc2626" stopOpacity="0" />
          <stop offset="1" stopColor="#450a0a" stopOpacity="0.55" />
        </radialGradient>
      </defs>
      <circle
        cx="12"
        cy="12"
        r="10"
        fill="#dc2626"
        stroke="#7f1d1d"
        strokeWidth="0.9"
      />
      <circle cx="12" cy="12" r="10" fill={`url(#${shade})`} />
      {/* Seam ridge */}
      <path
        d="M3.4 12c5.6 3.4 11.6 3.4 17.2 0"
        fill="none"
        stroke="#7f1d1d"
        strokeWidth="1.5"
        strokeLinecap="round"
        opacity="0.55"
      />
      {/* Stitches either side of the seam */}
      <path
        d="M3.9 10.4c5.4 3.2 10.8 3.2 16.2 0"
        fill="none"
        stroke="#fff"
        strokeWidth="1"
        strokeLinecap="round"
        strokeDasharray="1.3 1.1"
      />
      <path
        d="M3.9 13.9c5.4 3.2 10.8 3.2 16.2 0"
        fill="none"
        stroke="#fff"
        strokeWidth="1"
        strokeLinecap="round"
        strokeDasharray="1.3 1.1"
      />
      {/* Gloss */}
      <ellipse
        cx="8.4"
        cy="6.9"
        rx="2.6"
        ry="1.3"
        fill="#fff"
        opacity="0.28"
        transform="rotate(-32 8.4 6.9)"
      />
    </svg>
  );
};
