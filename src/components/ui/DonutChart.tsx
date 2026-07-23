interface Segment {
  label: string
  value: number
  color: string
}

interface DonutChartProps {
  segments: Segment[]
  total: number
  centerLabel?: string
  size?: number
  stroke?: number
}

/** Donut em SVG puro — sem dependências de biblioteca de gráficos. */
export function DonutChart({
  segments,
  total,
  centerLabel = 'Total',
  size = 168,
  stroke = 20,
}: DonutChartProps) {
  const radius = (size - stroke) / 2
  const circumference = 2 * Math.PI * radius
  const sum = segments.reduce((acc, s) => acc + s.value, 0) || 1

  let offset = 0
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        strokeWidth={stroke}
        className="stroke-slate-100 dark:stroke-slate-800"
      />
      {segments.map((s) => {
        const fraction = s.value / sum
        const dash = fraction * circumference
        const el = (
          <circle
            key={s.label}
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={s.color}
            strokeWidth={stroke}
            strokeDasharray={`${dash} ${circumference - dash}`}
            strokeDashoffset={-offset}
            strokeLinecap="round"
          />
        )
        offset += dash
        return el
      })}
      {/* Texto central (contra-rotacionado para ficar na horizontal) */}
      <g className="rotate-90" style={{ transformOrigin: 'center' }}>
        <text
          x="50%"
          y="46%"
          textAnchor="middle"
          className="fill-slate-900 text-2xl font-bold dark:fill-white"
          dominantBaseline="middle"
        >
          {total}
        </text>
        <text
          x="50%"
          y="60%"
          textAnchor="middle"
          className="fill-slate-400 text-[11px] font-medium uppercase tracking-wide"
          dominantBaseline="middle"
        >
          {centerLabel}
        </text>
      </g>
    </svg>
  )
}
