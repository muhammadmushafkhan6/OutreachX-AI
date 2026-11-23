import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  flexRender,
  createColumnHelper,
  type SortingState,
} from "@tanstack/react-table";
import { useState } from "react";
import { Link } from "react-router-dom";
import { ArrowUpDown, ExternalLink } from "lucide-react";
import type { Job } from "@/types";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { formatDate } from "@/lib/utils";
import { Button } from "@/components/ui/button";

const columnHelper = createColumnHelper<Job>();

const columns = [
  columnHelper.accessor("url", {
    header: "Research Target",
    cell: (info) => {
      const job = info.row.original;
      
      // Determine label based on mode
      let label;
      if (job.mode === "maps") {
        label = "Google Map Lead";
      } else if (job.mode === "social") {
        label = "Social Media Lead";
      } else if (job.type === "bulk") {
        label = "Data Scraping";
      } else {
        label = "Data Scraping";
      }
      
      return (
        <span className="font-bold tracking-tight text-foreground truncate max-w-[200px] block uppercase text-[10px]">
          {label}
        </span>
      );
    },
  }),
  columnHelper.accessor("type", {
    header: "Mode",
    cell: (info) => (
      <span className="font-black uppercase text-[10px] tracking-widest text-muted-foreground">{info.getValue()}</span>
    ),
  }),
  columnHelper.accessor("status", {
    header: "Pipeline Status",
    cell: (info) => <Badge status={info.getValue()} className="rounded-full font-black uppercase text-[9px] tracking-widest px-3 py-1" />,
  }),
  columnHelper.accessor("progress", {
    header: "Completion",
    cell: (info) => (
      <div className="flex items-center gap-3">
        <Progress value={info.getValue()} className="w-20 h-1.5 bg-muted" />
        <span className="text-[10px] font-black text-primary">{info.getValue()}%</span>
      </div>
    ),
  }),
  columnHelper.accessor("created_at", {
    header: "Timestamp",
    cell: (info) => (
      <span className="text-muted-foreground font-bold uppercase text-[9px] tracking-tighter">{formatDate(info.getValue())}</span>
    ),
  }),
  columnHelper.display({
    id: "actions",
    header: "",
    cell: ({ row }) => (
      <Link to={`/results?job=${row.original.id}`}>
        <Button variant="ghost" size="icon" className="rounded-full hover:bg-primary/20 hover:text-primary transition-all">
          <ExternalLink className="h-4 w-4" />
        </Button>
      </Link>
    ),
  }),
];

interface JobsTableProps {
  jobs: Job[];
}

export function JobsTable({ jobs }: JobsTableProps) {
  const [sorting, setSorting] = useState<SortingState>([]);

  const table = useReactTable({
    data: jobs,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  return (
    <div className="rounded-3xl border border-border/50 overflow-hidden bg-card/50 backdrop-blur-sm">
      <table className="w-full text-sm border-separate border-spacing-0">
        <thead>
          {table.getHeaderGroups().map((hg) => (
            <tr key={hg.id}>
              {hg.headers.map((header) => (
                <th
                  key={header.id}
                  className="px-6 py-5 text-left border-b border-border/50"
                >
                  {header.isPlaceholder ? null : (
                    <button
                      className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground hover:text-primary transition-colors"
                      onClick={header.column.getToggleSortingHandler()}
                    >
                      {flexRender(header.column.columnDef.header, header.getContext())}
                      <ArrowUpDown className="h-3 w-3 opacity-30" />
                    </button>
                  )}
                </th>
              ))}
            </tr>
          ))}
        </thead>
        <tbody>
          {table.getRowModel().rows.map((row) => (
            <tr key={row.id} className="group hover:bg-primary/5 transition-colors">
              {row.getVisibleCells().map((cell) => (
                <td key={cell.id} className="px-6 py-5 border-b border-border/50 group-last:border-0">
                  {flexRender(cell.column.columnDef.cell, cell.getContext())}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
