import { useRef, useState } from "react";
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  flexRender,
  createColumnHelper,
  type SortingState,
  type VisibilityState,
} from "@tanstack/react-table";
import { useVirtualizer } from "@tanstack/react-virtual";
import { ArrowUp, ArrowDown, ArrowUpDown, Settings2, Search, ChevronDown, Check } from "lucide-react";
import { Popover } from "@base-ui/react/popover";
import { Checkbox } from "@base-ui/react/checkbox";
import { Select } from "@base-ui/react/select";
import { Input } from "@base-ui/react/input";
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
  columnHelper.accessor("hasIndex", {
    id: "hasIndex",
    header: "Deck",
    cell: ({ getValue }) => (getValue() ? "✓" : "—"),
    enableSorting: false,
    meta: { className: "col-deck" },
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

const TOGGLEABLE_COLUMNS: { id: string; label: string }[] = [
  { id: "hasIndex", label: "Deck" },
  { id: "hskLevel", label: "HSK" },
  { id: "frequency", label: "Freq" },
  { id: "pinyin", label: "Pinyin" },
];

function stripDiacritics(s: string): string {
  return s.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

export function WordList({ words, initialColumnVisibility = {} }: { words: WordWithTracking[]; initialColumnVisibility?: VisibilityState }) {
  const [sorting, setSorting] = useState<SortingState>([
    { id: "frequency", desc: false },
  ]);
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>(initialColumnVisibility);
  const [globalFilter, setGlobalFilter] = useState("");
  const [searchField, setSearchField] = useState<"all" | "character" | "pinyin" | "meaning">("all");
  const scrollRef = useRef<HTMLDivElement>(null);

  const handleColumnVisibilityChange = (updater: VisibilityState | ((old: VisibilityState) => VisibilityState)) => {
    setColumnVisibility((prev) => {
      const next = typeof updater === "function" ? updater(prev) : updater;
      document.cookie = `col-visibility=${JSON.stringify(next)};path=/;max-age=${60 * 60 * 24 * 365}`;
      return next;
    });
  };

  const table = useReactTable({
    data: words,
    columns,
    state: { sorting, columnVisibility, globalFilter: `${searchField}:${globalFilter}` },
    onSortingChange: setSorting,
    onColumnVisibilityChange: handleColumnVisibilityChange,
    onGlobalFilterChange: (value: string) => {
      const colonIdx = value.indexOf(":");
      if (colonIdx !== -1) {
        setGlobalFilter(value.slice(colonIdx + 1));
      }
    },
    globalFilterFn: (row, _columnId, filterValue: string) => {
      const colonIdx = filterValue.indexOf(":");
      const field = colonIdx !== -1 ? filterValue.slice(0, colonIdx) : "all";
      const q = (colonIdx !== -1 ? filterValue.slice(colonIdx + 1) : filterValue).toLowerCase();
      if (!q) return true;
      const w = row.original;
      const pinyinLower = w.pinyin.toLowerCase();
      const pinyinNorm = stripDiacritics(pinyinLower);
      const pinyinNoSpaces = pinyinNorm.replace(/\s+/g, "");
      const matchPinyin = pinyinLower.includes(q) || pinyinNorm.includes(q) || pinyinNoSpaces.includes(q.replace(/\s+/g, ""));
      switch (field) {
        case "character": return w.character.includes(q);
        case "pinyin": return matchPinyin;
        case "meaning": return w.meaning.toLowerCase().includes(q);
        default: return (
          w.character.includes(q) ||
          matchPinyin ||
          w.meaning.toLowerCase().includes(q)
        );
      }
    },
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  const { rows } = table.getRowModel();

  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 20,
    getItemKey: (index) => rows[index].id,
    measureElement: (el) => el.getBoundingClientRect().height,
  });

  return (
    <>
    <div className="table-toolbar">
      <div className="search-box">
        <Search size={14} className="search-icon" />
        <Select.Root
          value={searchField}
          onValueChange={(val) => setSearchField(val as typeof searchField)}
        >
          <Select.Trigger className="search-field-trigger">
            <Select.Value />
            <Select.Icon className="search-field-icon">
              <ChevronDown size={12} />
            </Select.Icon>
          </Select.Trigger>
          <Select.Portal>
            <Select.Positioner side="bottom" align="start" sideOffset={4} className="search-field-positioner">
              <Select.Popup className="search-field-popup">
                {[
                  { value: "all", label: "All" },
                  { value: "character", label: "Character" },
                  { value: "pinyin", label: "Pinyin" },
                  { value: "meaning", label: "Meaning" },
                ].map((opt) => (
                  <Select.Item key={opt.value} value={opt.value} className="search-field-item">
                    <Select.ItemIndicator className="search-field-indicator">
                      <Check size={12} />
                    </Select.ItemIndicator>
                    <Select.ItemText>{opt.label}</Select.ItemText>
                  </Select.Item>
                ))}
              </Select.Popup>
            </Select.Positioner>
          </Select.Portal>
        </Select.Root>
        <Input
          className="search-input"
          placeholder={searchField === "all" ? "Search words..." : `Search ${searchField}...`}
          value={globalFilter}
          onChange={(e) => setGlobalFilter((e.target as HTMLInputElement).value)}
        />
      </div>
      <Popover.Root>
        <Popover.Trigger className="columns-pill">
          <Settings2 size={14} />
          Columns
        </Popover.Trigger>
        <Popover.Portal>
          <Popover.Positioner side="bottom" align="center" sideOffset={4} className="columns-positioner">
            <Popover.Popup className="columns-popup">
              {TOGGLEABLE_COLUMNS.map((col) => {
                const column = table.getColumn(col.id);
                if (!column) return null;
                return (
                  <label key={col.id} className="columns-item">
                    <Checkbox.Root
                      className="columns-checkbox"
                      checked={column.getIsVisible()}
                      onCheckedChange={(checked) =>
                        column.toggleVisibility(!!checked)
                      }
                    >
                      <Checkbox.Indicator className="columns-checkbox-indicator">
                        &#10003;
                      </Checkbox.Indicator>
                    </Checkbox.Root>
                    {col.label}
                  </label>
                );
              })}
            </Popover.Popup>
          </Popover.Positioner>
        </Popover.Portal>
      </Popover.Root>
    </div>
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
                ref={virtualizer.measureElement}
                data-index={virtualRow.index}
                className={word.isTracked ? "tracked" : ""}
                style={{
                  position: "absolute",
                  top: 0,
                  left: 0,
                  width: "100%",
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
    </>
  );
}
