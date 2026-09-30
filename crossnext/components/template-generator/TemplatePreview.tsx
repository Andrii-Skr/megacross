"use client";

import { CLUE_MAP } from "@megacross/cross-format";
import { memo } from "react";
import type { GenerationResult } from "./types";

export const TemplatePreview = memo(function TemplatePreview({ result }: { result: GenerationResult }) {
  const { grid, metrics } = result;
  return (
    <svg
      viewBox={`0 0 ${grid.cols} ${grid.rows}`}
      className="aspect-auto w-full max-h-72 bg-muted/30"
      role="img"
      aria-label={`Template ${result.ordinal}`}
    >
      {grid.data.flatMap((line, row) =>
        [...line].map((cell, col) => {
          if (cell === "%") return null;
          const blocked = cell === "#";
          const arrowCount = CLUE_MAP[grid.codes[row]?.[col] ?? 0]?.length ?? 0;
          return (
            // biome-ignore lint/suspicious/noArrayIndexKey: row and column are immutable grid coordinates
            <g key={`${row}-${col}`}>
              <rect
                x={col}
                y={row}
                width="1"
                height="1"
                fill={blocked ? "currentColor" : "white"}
                className={blocked ? "text-slate-300 dark:text-slate-700" : "text-white dark:text-slate-950"}
                stroke="currentColor"
                strokeWidth="0.035"
              />
              {arrowCount === 2 && (
                <>
                  <text
                    x={col + 0.35}
                    y={row + 0.53}
                    textAnchor="middle"
                    fontSize="0.43"
                    fill="currentColor"
                    className="text-slate-700 dark:text-slate-200"
                  >
                    →
                  </text>
                  <text
                    x={col + 0.7}
                    y={row + 0.82}
                    textAnchor="middle"
                    fontSize="0.43"
                    fill="currentColor"
                    className="text-slate-700 dark:text-slate-200"
                  >
                    ↓
                  </text>
                </>
              )}
              {!blocked && cell !== "*" && arrowCount !== 2 && (
                <text
                  x={col + 0.5}
                  y={row + 0.69}
                  textAnchor="middle"
                  fontSize="0.55"
                  fill="currentColor"
                  className="text-slate-700 dark:text-slate-200"
                >
                  {cell}
                </text>
              )}
            </g>
          );
        }),
      )}
      {metrics.pictureBounds.map((picture, index) => (
        <rect
          key={`${picture.row}-${picture.col}-${index}`}
          x={picture.col + 0.08}
          y={picture.row + 0.08}
          width={picture.width - 0.16}
          height={picture.height - 0.16}
          fill="none"
          stroke="#f59e0b"
          strokeWidth="0.16"
          strokeDasharray="0.35 0.2"
        />
      ))}
    </svg>
  );
});
