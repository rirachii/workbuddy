"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { Home, List, Settings } from "lucide-react"
import { cn } from "@/lib/utils"

export function BottomNav() {
  const pathname = usePathname()

  const links = [
    {
      href: "/",
      label: "Record",
      icon: Home,
      isActive: pathname === "/"
    },
    {
      href: "/notes",
      label: "Notes",
      icon: List,
      isActive: pathname.startsWith("/notes")
    },
    {
      href: "/settings",
      label: "Settings",
      icon: Settings,
      isActive: pathname === "/settings"
    }
  ]

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 h-16 bg-background border-t">
      <div className="grid h-full max-w-lg grid-cols-3 mx-auto">
        {links.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className={cn(
              "inline-flex flex-col items-center justify-center px-5 hover:bg-accent",
              link.isActive && "text-primary"
            )}
          >
            <link.icon className="w-6 h-6" />
            <span className="text-xs">{link.label}</span>
          </Link>
        ))}
      </div>
    </nav>
  )
} 