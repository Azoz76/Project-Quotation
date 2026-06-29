export function ConstructionBg() {
  return (
    <svg
      className="fixed inset-0 w-full h-full"
      viewBox="0 0 1200 800"
      preserveAspectRatio="xMidYMax slice"
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <linearGradient id="skyGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#091d3e" />
          <stop offset="40%" stopColor="#0f2b5b" />
          <stop offset="100%" stopColor="#1a3f7a" />
        </linearGradient>
        <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
          <path d="M 40 0 L 0 0 0 40" fill="none" stroke="rgba(255,255,255,0.03)" strokeWidth="0.5" />
        </pattern>
      </defs>

      <rect width="1200" height="800" fill="url(#skyGrad)" />
      <rect width="1200" height="800" fill="url(#grid)" />

      {/* Blueprint circles */}
      <circle cx="100" cy="650" r="120" fill="none" stroke="rgba(232,115,26,0.06)" strokeWidth="1" />
      <circle cx="100" cy="650" r="80" fill="none" stroke="rgba(232,115,26,0.04)" strokeWidth="1" />
      <circle cx="1100" cy="150" r="100" fill="none" stroke="rgba(255,255,255,0.04)" strokeWidth="1" />
      <circle cx="1100" cy="150" r="60" fill="none" stroke="rgba(255,255,255,0.03)" strokeWidth="1" />

      {/* Ground line */}
      <line x1="0" y1="720" x2="1200" y2="720" stroke="rgba(255,255,255,0.08)" strokeWidth="1" />

      {/* Building 1 - left tall */}
      <g stroke="rgba(255,255,255,0.12)" strokeWidth="0.8" fill="none">
        <rect x="80" y="420" width="70" height="300" />
        <line x1="80" y1="450" x2="150" y2="450" />
        <line x1="80" y1="480" x2="150" y2="480" />
        <line x1="80" y1="510" x2="150" y2="510" />
        <line x1="80" y1="540" x2="150" y2="540" />
        <line x1="80" y1="570" x2="150" y2="570" />
        <line x1="80" y1="600" x2="150" y2="600" />
        <line x1="80" y1="630" x2="150" y2="630" />
        <line x1="80" y1="660" x2="150" y2="660" />
        <line x1="80" y1="690" x2="150" y2="690" />
        <line x1="115" y1="420" x2="115" y2="720" />
        {/* Windows */}
        <rect x="88" y="428" width="20" height="15" />
        <rect x="122" y="428" width="20" height="15" />
        <rect x="88" y="458" width="20" height="15" />
        <rect x="122" y="458" width="20" height="15" />
        <rect x="88" y="488" width="20" height="15" />
        <rect x="122" y="488" width="20" height="15" />
        <rect x="88" y="518" width="20" height="15" />
        <rect x="122" y="518" width="20" height="15" />
      </g>

      {/* Building 2 */}
      <g stroke="rgba(255,255,255,0.10)" strokeWidth="0.8" fill="none">
        <rect x="160" y="500" width="60" height="220" />
        <rect x="168" y="510" width="18" height="14" />
        <rect x="194" y="510" width="18" height="14" />
        <rect x="168" y="535" width="18" height="14" />
        <rect x="194" y="535" width="18" height="14" />
        <rect x="168" y="560" width="18" height="14" />
        <rect x="194" y="560" width="18" height="14" />
        <rect x="168" y="585" width="18" height="14" />
        <rect x="194" y="585" width="18" height="14" />
        <rect x="168" y="610" width="18" height="14" />
        <rect x="194" y="610" width="18" height="14" />
      </g>

      {/* Building 3 - mid */}
      <g stroke="rgba(255,255,255,0.09)" strokeWidth="0.8" fill="none">
        <rect x="230" y="460" width="55" height="260" />
        <line x1="230" y1="490" x2="285" y2="490" />
        <line x1="230" y1="520" x2="285" y2="520" />
        <line x1="230" y1="550" x2="285" y2="550" />
        <line x1="230" y1="580" x2="285" y2="580" />
        <line x1="230" y1="610" x2="285" y2="610" />
        <line x1="257" y1="460" x2="257" y2="720" />
      </g>

      {/* Crane 1 - left */}
      <g stroke="rgba(232,115,26,0.15)" strokeWidth="1" fill="none">
        <line x1="320" y1="720" x2="320" y2="320" />
        <line x1="310" y1="720" x2="330" y2="720" />
        <line x1="320" y1="320" x2="420" y2="320" />
        <line x1="320" y1="320" x2="280" y2="320" />
        <line x1="420" y1="320" x2="420" y2="380" />
        <line x1="320" y1="340" x2="420" y2="340" />
        {/* Diagonal bracing */}
        <line x1="320" y1="320" x2="340" y2="340" />
        <line x1="340" y1="320" x2="360" y2="340" />
        <line x1="360" y1="320" x2="380" y2="340" />
        <line x1="380" y1="320" x2="400" y2="340" />
        {/* Counter weight */}
        <line x1="280" y1="320" x2="270" y2="340" />
        <rect x="260" y="340" width="20" height="15" />
      </g>

      {/* Building cluster - right side */}
      <g stroke="rgba(255,255,255,0.10)" strokeWidth="0.8" fill="none">
        {/* Tall building */}
        <rect x="900" y="380" width="80" height="340" />
        <rect x="910" y="390" width="25" height="18" />
        <rect x="945" y="390" width="25" height="18" />
        <rect x="910" y="418" width="25" height="18" />
        <rect x="945" y="418" width="25" height="18" />
        <rect x="910" y="446" width="25" height="18" />
        <rect x="945" y="446" width="25" height="18" />
        <rect x="910" y="474" width="25" height="18" />
        <rect x="945" y="474" width="25" height="18" />
        <rect x="910" y="502" width="25" height="18" />
        <rect x="945" y="502" width="25" height="18" />
        <rect x="910" y="530" width="25" height="18" />
        <rect x="945" y="530" width="25" height="18" />

        {/* Medium building */}
        <rect x="990" y="480" width="65" height="240" />
        <rect x="998" y="490" width="20" height="14" />
        <rect x="1028" y="490" width="20" height="14" />
        <rect x="998" y="515" width="20" height="14" />
        <rect x="1028" y="515" width="20" height="14" />
        <rect x="998" y="540" width="20" height="14" />
        <rect x="1028" y="540" width="20" height="14" />
        <rect x="998" y="565" width="20" height="14" />
        <rect x="1028" y="565" width="20" height="14" />

        {/* Short building */}
        <rect x="1065" y="560" width="55" height="160" />
        <rect x="1073" y="570" width="16" height="12" />
        <rect x="1097" y="570" width="16" height="12" />
        <rect x="1073" y="592" width="16" height="12" />
        <rect x="1097" y="592" width="16" height="12" />
      </g>

      {/* Crane 2 - right */}
      <g stroke="rgba(232,115,26,0.12)" strokeWidth="1" fill="none">
        <line x1="1050" y1="720" x2="1050" y2="350" />
        <line x1="1050" y1="350" x2="1150" y2="350" />
        <line x1="1050" y1="350" x2="1020" y2="350" />
        <line x1="1150" y1="350" x2="1150" y2="400" />
        <line x1="1050" y1="370" x2="1150" y2="370" />
        <line x1="1050" y1="350" x2="1070" y2="370" />
        <line x1="1070" y1="350" x2="1090" y2="370" />
        <line x1="1090" y1="350" x2="1110" y2="370" />
        <line x1="1110" y1="350" x2="1130" y2="370" />
        <line x1="1020" y1="350" x2="1010" y2="370" />
        <rect x="1000" y="370" width="20" height="12" />
      </g>

      {/* Blueprint rolls - bottom left */}
      <g stroke="rgba(255,255,255,0.10)" strokeWidth="0.8" fill="none">
        <ellipse cx="60" cy="740" rx="50" ry="8" />
        <line x1="10" y1="740" x2="10" y2="760" />
        <line x1="110" y1="740" x2="110" y2="760" />
        <ellipse cx="60" cy="760" rx="50" ry="8" />
        <ellipse cx="130" cy="750" rx="40" ry="7" />
        <line x1="90" y1="750" x2="90" y2="768" />
        <line x1="170" y1="750" x2="170" y2="768" />
        <ellipse cx="130" cy="768" rx="40" ry="7" />
      </g>

      {/* Compass/protractor - bottom right */}
      <g stroke="rgba(232,115,26,0.10)" strokeWidth="0.8" fill="none">
        <circle cx="1130" cy="740" r="30" />
        <line x1="1130" y1="710" x2="1130" y2="740" />
        <line x1="1130" y1="740" x2="1155" y2="760" />
        <line x1="1130" y1="740" x2="1105" y2="760" />
      </g>

      {/* Scattered small dots like blueprint marks */}
      <g fill="rgba(255,255,255,0.05)">
        <circle cx="500" cy="200" r="2" />
        <circle cx="700" cy="300" r="2" />
        <circle cx="400" cy="600" r="2" />
        <circle cx="800" cy="500" r="2" />
        <circle cx="600" cy="100" r="1.5" />
        <circle cx="200" cy="300" r="1.5" />
        <circle cx="1000" cy="200" r="1.5" />
      </g>

      {/* Trees between buildings */}
      <g stroke="rgba(255,255,255,0.08)" strokeWidth="0.8" fill="none">
        <line x1="350" y1="720" x2="350" y2="680" />
        <circle cx="350" cy="665" r="18" />
        <circle cx="340" cy="670" r="12" />
        <circle cx="360" cy="670" r="12" />

        <line x1="850" y1="720" x2="850" y2="690" />
        <circle cx="850" cy="678" r="15" />
        <circle cx="842" cy="682" r="10" />
        <circle cx="858" cy="682" r="10" />
      </g>
    </svg>
  );
}
