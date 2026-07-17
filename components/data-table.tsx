"use client";

import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable
} from "@tanstack/react-table";
import { ArrowUpDown, ChevronLeft, ChevronRight, Search } from "lucide-react";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, Td, Th } from "@/components/ui/table";

type DataTableProps<T> = {
  columns: ColumnDef<T>[];
  data: T[];
  searchPlaceholder?: string;
};

export function DataTable<T>({ columns, data, searchPlaceholder = "Ara" }: DataTableProps<T>) {
  const [globalFilter, setGlobalFilter] = useState("");
  const table = useReactTable({
    data,
    columns,
    state: { globalFilter },
    onGlobalFilterChange: setGlobalFilter,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel()
  });

  const pageLabel = useMemo(
    () => `${table.getState().pagination.pageIndex + 1} / ${table.getPageCount() || 1}`,
    [table]
  );

  return (
    <div className="space-y-3">
      <label className="relative block max-w-sm">
        <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-muted" />
        <Input
          className="pl-9"
          value={globalFilter}
          onChange={(event) => setGlobalFilter(event.target.value)}
          placeholder={searchPlaceholder}
        />
      </label>

      <div className="overflow-hidden rounded-md border border-border bg-surface shadow-table">
        <div className="overflow-x-auto">
          <Table>
            <thead>
              {table.getHeaderGroups().map((headerGroup) => (
                <tr key={headerGroup.id}>
                  {headerGroup.headers.map((header) => (
                    <Th key={header.id}>
                      {header.isPlaceholder ? null : (
                        <button
                          className="inline-flex items-center gap-2"
                          onClick={header.column.getToggleSortingHandler()}
                          type="button"
                        >
                          {flexRender(header.column.columnDef.header, header.getContext())}
                          {header.column.getCanSort() ? <ArrowUpDown className="h-3.5 w-3.5" /> : null}
                        </button>
                      )}
                    </Th>
                  ))}
                </tr>
              ))}
            </thead>
            <tbody>
              {table.getRowModel().rows.length ? (
                table.getRowModel().rows.map((row) => (
                  <tr key={row.id}>
                    {row.getVisibleCells().map((cell) => (
                      <Td key={cell.id}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</Td>
                    ))}
                  </tr>
                ))
              ) : (
                <tr>
                  <Td className="py-8 text-center text-muted" colSpan={columns.length}>
                    Kayıt bulunamadı.
                  </Td>
                </tr>
              )}
            </tbody>
          </Table>
        </div>
      </div>

      <div className="flex items-center justify-end gap-2 text-sm text-muted">
        <Button
          aria-label="Önceki sayfa"
          disabled={!table.getCanPreviousPage()}
          onClick={() => table.previousPage()}
          type="button"
          variant="secondary"
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <span>{pageLabel}</span>
        <Button
          aria-label="Sonraki sayfa"
          disabled={!table.getCanNextPage()}
          onClick={() => table.nextPage()}
          type="button"
          variant="secondary"
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
