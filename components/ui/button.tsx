import * as React from "react";
import { cn } from "@/lib/utils";

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost" | "danger";
};

export function Button({ className, variant = "primary", ...props }: ButtonProps) {
  return (
    <button
      className={cn(
        "inline-flex h-9 items-center justify-center gap-2 rounded-md px-3 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-60",
        variant === "primary" && "bg-accent text-white hover:bg-[#c77e14]",
        variant === "secondary" && "border border-border bg-surface text-foreground hover:bg-accentSoft",
        variant === "ghost" && "text-foreground hover:bg-accentSoft",
        variant === "danger" && "bg-danger text-white hover:bg-[#951f16]",
        className
      )}
      {...props}
    />
  );
}
