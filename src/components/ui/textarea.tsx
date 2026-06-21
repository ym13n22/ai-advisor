import * as React from "react";
import { cn } from "@/lib/utils";

export function Textarea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} className={cn("min-h-24 w-full rounded-md border border-slate-200 px-3 py-2 text-sm outline-none focus:border-slate-500", props.className)} />;
}
