import { DateTime } from 'luxon'
import { Link } from 'react-router-dom'
import { weekdayShort } from '../lib/dates'
import {
  fastBandPlacement,
  formatFastDuration,
  formatFastHoursCompact,
  overnightWindow,
} from '../lib/fasting'

export type FastingChartPoint = {
  key: string
  date: Date
  fastingMinutes: number | null
  fastStart: DateTime | null
  fastEnd: DateTime | null
  inProgress: boolean
}

export function FastingChart({ points }: { points: FastingChartPoint[] }) {
  return (
    <section className="card chart-card fasting-chart-card">
      <div className="goal-head">
        <span className="goal-label fasting">Overnight</span>
        <span className="muted">6pm → noon</span>
      </div>
      <div className="fast-chart">
        <div className="fast-axis" aria-hidden="true">
          <span>6p</span>
          <span>12a</span>
          <span>6a</span>
          <span>12p</span>
        </div>
        <div
          className="fast-days"
          style={{ gridTemplateColumns: `repeat(${points.length}, minmax(0, 1fr))` }}
        >
          {points.map((point) => {
            const window = overnightWindow(point.key)
            const band =
              point.fastStart && point.fastEnd
                ? fastBandPlacement(point.fastStart, point.fastEnd, window.start, window.end)
                : null
            const label =
              point.fastingMinutes == null
                ? 'Overnight —'
                : `Overnight ${formatFastDuration(point.fastingMinutes)}${
                    point.fastStart && point.fastEnd
                      ? ` · ${point.fastStart.toFormat('t')} → ${point.fastEnd.toFormat('t')}`
                      : ''
                  }${point.inProgress ? ' and counting' : ''}`
            return (
              <Link key={point.key} className="chart-col fast-col" to={`/?d=${point.key}`} title={label}>
                <div className="chart-track fast-track">
                  <div className="fast-midnight" />
                  {band ? (
                    <div
                      className={`fast-band${point.inProgress ? ' in-progress' : ''}`}
                      style={{ top: `${band.top}%`, height: `${Math.max(band.height, 3)}%` }}
                    />
                  ) : null}
                </div>
                <span>{weekdayShort(point.date)}</span>
                <span className="chart-num">
                  {point.fastingMinutes == null ? '–' : `${formatFastHoursCompact(point.fastingMinutes)}h`}
                </span>
              </Link>
            )
          })}
        </div>
      </div>
    </section>
  )
}
