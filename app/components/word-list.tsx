import { useState } from "react";
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  flexRender,
  createColumnHelper,
  type SortingState,
} from "@tanstack/react-table";
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

export function WordList({ words }: { words: WordWithTracking[] }) {
  const [sorting, setSorting] = useState<SortingState>([]);

  const table = useReactTable({
    data: words,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  return (
    <div className="word-list-container">
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
        <tbody>
          {table.getRowModel().rows.map((row) => {
            const word = row.original;
            return (
              <tr
                key={row.id}
                className={word.isTracked ? "tracked" : ""}
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
