"use client";
import { sidebarOpen } from "@/hooks/atoms";
import { cn } from "@/lib/utils";
import { useAtom } from "jotai";

export default function MainWrapper({ children }: { children: React.ReactNode }) {
  const [isOpen] = useAtom(sidebarOpen);

  return (
    <main className={cn("min-h-screen w-full bg-muted/60 transition-[padding-left]",
      isOpen ? "pl-[18rem]" : "pl-[3.5rem]"
    )}>
      {children}
    </main>
  );
}