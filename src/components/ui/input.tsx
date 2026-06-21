import * as React from "react";
import { cn } from "@/lib/utils";

export function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={cn("h-9 w-full rounded-md border border-slate-200 px-3 text-sm outline-none focus:border-slate-500", props.className)} />;
}
