import * as React from "react";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

interface CampoProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "type"> {
  label?: string;
  ayuda?: string;
  error?: string;
  type?: "text" | "email" | "password" | "number" | "select" | "checkbox" | "textarea" | "date";
  children?: React.ReactNode;
  value?: string;
  onChange?: (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>,
  ) => void;
  /** Filas del textarea (solo `type="textarea"`). */
  rows?: number | undefined;
}

export function Campo({
  label,
  ayuda,
  error,
  className,
  id,
  type = "text",
  children,
  value,
  onChange,
  ...props
}: CampoProps) {
  return (
    <div className="space-y-1.5">
      {label && (
        <Label htmlFor={id} className="text-sm font-semibold">
          {label}
        </Label>
      )}
      {type === "select" ? (
        <select
          id={id}
          value={value}
          onChange={onChange as React.ChangeEventHandler<HTMLSelectElement>}
          className={cn(
            "h-11 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50",
            error && "border-destructive",
            className,
          )}
          aria-invalid={error ? true : undefined}
          {...(props as React.SelectHTMLAttributes<HTMLSelectElement>)}
        >
          {children}
        </select>
      ) : type === "checkbox" ? (
        <div className="flex items-center gap-2">
          <input
            id={id}
            type="checkbox"
            checked={(props as React.InputHTMLAttributes<HTMLInputElement>).checked}
            onChange={onChange as React.ChangeEventHandler<HTMLInputElement>}
            className={cn(
              "h-4 w-4 rounded border-input bg-background text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              error && "border-destructive",
            )}
            aria-invalid={error ? true : undefined}
            {...(props as React.InputHTMLAttributes<HTMLInputElement>)}
          />
          {children}
        </div>
      ) : type === "textarea" ? (
        <textarea
          id={id}
          value={value}
          onChange={onChange as React.ChangeEventHandler<HTMLTextAreaElement>}
          className={cn(
            "min-h-20 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50",
            error && "border-destructive",
            className,
          )}
          aria-invalid={error ? true : undefined}
          {...(props as React.TextareaHTMLAttributes<HTMLTextAreaElement>)}
        />
      ) : (
        <input
          id={id}
          type={type}
          value={value}
          onChange={onChange as React.ChangeEventHandler<HTMLInputElement>}
          className={cn(
            "h-11 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50",
            error && "border-destructive",
            className,
          )}
          aria-invalid={error ? true : undefined}
          {...(props as React.InputHTMLAttributes<HTMLInputElement>)}
        />
      )}
      {ayuda && !error && <p className="text-xs text-muted-foreground">{ayuda}</p>}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
