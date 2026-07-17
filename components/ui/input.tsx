import * as React from "react";
import { cn } from "@/lib/utils";

export function Input({ className, ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        "h-9 w-full rounded-md border border-border bg-white px-3 text-sm outline-none ring-accent/20 transition placeholder:text-muted focus:ring-4",
        className
      )}
      {...props}
    />
  );
}

export function Textarea({ className, ...props }: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      className={cn(
        "min-h-20 w-full rounded-md border border-border bg-white px-3 py-2 text-sm outline-none ring-accent/20 transition placeholder:text-muted focus:ring-4",
        className
      )}
      {...props}
    />
  );
}
