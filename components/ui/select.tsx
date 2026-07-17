import * as React from "react";
import { cn } from "@/lib/utils";

export function Select({ className, ...props }: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className={cn(
        "h-9 w-full rounded-md border border-border bg-white px-3 text-sm outline-none ring-accent/20 transition focus:ring-4",
        className
      )}
      {...props}
    />
  );
}
