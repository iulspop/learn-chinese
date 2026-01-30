import type { FrequencyStats } from "~/lib/types";

export function FrequencyCoverage({ stats, isHsk7 }: { stats: FrequencyStats; isHsk7?: boolean }) {
  const maxCount = Math.max(...stats.buckets.map((b) => b.hskCount), 1);
  const chartHeight = 160;
  const topMargin = 14;
  const leftMargin = 50;
  const bottomMargin = 40;
  const chartWidth = stats.buckets.length * 32;
  const totalWidth = leftMargin + chartWidth;
  const totalHeight = topMargin + chartHeight + bottomMargin;

  // Y-axis tick values
  const yTicks = [0, Math.round(maxCount / 2), maxCount];

  return (
    <div className="freq-coverage">
      <div className="freq-header">
        <h2>Frequency Coverage</h2>
        <span className="freq-summary">
          {isHsk7 ? (
            <>
              {stats.levelTracked} / {stats.levelWords} HSK 7-9 words tracked
              {" "}&middot;{" "}
              {stats.totalTracked} / {stats.totalWords} total HSK words tracked
            </>
          ) : (
            <>
              {stats.topNTracked} / {stats.topNTotal} HSK words in top 5000 tracked
              ({stats.coveragePercent}%)
            </>
          )}
        </span>
      </div>
      <div className="freq-chart">
        <svg viewBox={`0 0 ${totalWidth} ${totalHeight}`} className="freq-svg">
          <g transform={`translate(0, ${topMargin})`}>
          {/* Y-axis label */}
          <text
            x={12}
            y={chartHeight / 2}
            textAnchor="middle"
            transform={`rotate(-90, 12, ${chartHeight / 2})`}
            className="freq-axis-label"
          >
            # of words
          </text>

          {/* Y-axis ticks */}
          {yTicks.map((tick) => {
            const y = chartHeight - (tick / maxCount) * chartHeight;
            return (
              <g key={tick}>
                <text
                  x={leftMargin - 6}
                  y={y + 3}
                  textAnchor="end"
                  className="freq-label"
                >
                  {tick}
                </text>
                <line
                  x1={leftMargin}
                  y1={y}
                  x2={totalWidth}
                  y2={y}
                  className="freq-gridline"
                />
              </g>
            );
          })}

          {/* Bars */}
          {stats.buckets.map((bucket, i) => {
            const hskHeight = (bucket.hskCount / maxCount) * chartHeight;
            const trackedHeight = (bucket.trackedCount / maxCount) * chartHeight;
            const x = leftMargin + i * 32 + 4;
            const barWidth = 24;

            return (
              <g key={bucket.rangeLabel}>
                <rect
                  x={x}
                  y={chartHeight - hskHeight}
                  width={barWidth}
                  height={hskHeight}
                  className="freq-bar-hsk"
                />
                <rect
                  x={x}
                  y={chartHeight - trackedHeight}
                  width={barWidth}
                  height={trackedHeight}
                  className="freq-bar-tracked"
                />
                {i % 4 === 0 && (
                  <text
                    x={x + barWidth / 2}
                    y={chartHeight + 16}
                    textAnchor="middle"
                    className="freq-label"
                  >
                    {bucket.min}
                  </text>
                )}
              </g>
            );
          })}

          {/* X-axis label */}
          <text
            x={leftMargin + chartWidth / 2}
            y={chartHeight + 34}
            textAnchor="middle"
            className="freq-axis-label"
          >
            Word frequency rank (1 = most common)
          </text>
          </g>
        </svg>
      </div>
      <div className="freq-legend">
        <span className="legend-item">
          <span className="legend-swatch legend-hsk" /> HSK words
        </span>
        <span className="legend-item">
          <span className="legend-swatch legend-tracked" /> Tracked
        </span>
      </div>
    </div>
  );
}
