import { useRef, useState } from "react";
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  flexRender,
  createColumnHelper,
  type SortingState,
} from "@tanstack/react-table";
import { useVirtualizer } from "@tanstack/react-virtual";
import { ArrowUp, ArrowDown, ArrowUpDown } from "lucide-react";
import type { WordWithTracking } from "~/lib/types";
import { TrackCell } from "./word-list-item";

const columnHelper = createColumnHelper<WordWithTracking>();

const columns = [
  columnHelper.display({
    id: "track",
    header: "Track",
    cell: ({ row }) => <TrackCell word={row.original} />,
    meta: { className: "col-track" },
  }),
  columnHelper.accessor("character", {
    header: "Character",
    enableSorting: false,
    meta: { className: "col-character" },
  }),
  columnHelper.accessor("pinyin", {
    header: "Pinyin",
    enableSorting: false,
    meta: { className: "col-pinyin" },
  }),
  columnHelper.accessor("meaning", {
    header: "Meaning",
    enableSorting: false,
    meta: { className: "col-meaning" },
  }),
  columnHelper.accessor("hskLevel", {
    header: "HSK",
    meta: { className: "col-level" },
  }),
  columnHelper.accessor("frequency", {
    header: "Freq",
    cell: ({ getValue }) => {
      const v = getValue();
      return v > 9999 ? "10k+" : v.toLocaleString();
    },
    meta: { className: "col-freq" },
  }),
];

const ROW_HEIGHT = 41;

export function WordList({ words }: { words: WordWithTracking[] }) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const scrollRef = useRef<HTMLDivElement>(null);

  const table = useReactTable({
    data: words,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  const { rows } = table.getRowModel();

  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 20,
  });

  return (
    <div className="word-list-container" ref={scrollRef}>
      <table className="word-table">
        <thead>
          {table.getHeaderGroups().map((headerGroup) => (
            <tr key={headerGroup.id}>
              {headerGroup.headers.map((header) => {
                const meta = header.column.columnDef.meta as
                  | { className?: string }
                  | undefined;
                return (
                  <th
                    key={header.id}
                    className={meta?.className}
                    onClick={header.column.getToggleSortingHandler()}
                    style={
                      header.column.getCanSort()
                        ? { cursor: "pointer", userSelect: "none" }
                        : undefined
                    }
                  >
                    <span className="th-content">
                      {flexRender(
                        header.column.columnDef.header,
                        header.getContext()
                      )}
                      {header.column.getCanSort() && (
                        <span className="sort-indicator">
                          {header.column.getIsSorted() === "asc" ? (
                            <ArrowUp size={14} />
                          ) : header.column.getIsSorted() === "desc" ? (
                            <ArrowDown size={14} />
                          ) : (
                            <ArrowUpDown size={14} />
                          )}
                        </span>
                      )}
                    </span>
                  </th>
                );
              })}
            </tr>
          ))}
        </thead>
        <tbody
          style={{
            height: `${virtualizer.getTotalSize()}px`,
            position: "relative",
          }}
        >
          {virtualizer.getVirtualItems().map((virtualRow) => {
            const row = rows[virtualRow.index];
            const word = row.original;
            return (
              <tr
                key={row.id}
                className={word.isTracked ? "tracked" : ""}
                style={{
                  position: "absolute",
                  top: 0,
                  left: 0,
                  width: "100%",
                  height: `${virtualRow.size}px`,
                  transform: `translateY(${virtualRow.start}px)`,
                }}
              >
                {row.getVisibleCells().map((cell) => {
                  const meta = cell.column.columnDef.meta as
                    | { className?: string }
                    | undefined;
                  return (
                    <td key={cell.id} className={meta?.className}>
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext()
                      )}
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
