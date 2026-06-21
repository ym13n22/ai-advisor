import * as React from "react";
import { cn } from "@/lib/utils";

export function Card(props: React.HTMLAttributes<HTMLDivElement>) {
  return <div {...props} className={cn("rounded-lg border border-slate-200 bg-white p-4 shadow-sm", props.className)} />;
}
