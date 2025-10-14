"use client"

import * as React from "react"
import { cn } from "@/lib/utils"

interface ComboboxProps {
  items: {
    value: string
    label: string
  }[]
  value?: string
  onValueChange?: (value: string) => void
  placeholder?: string
  emptyMessage?: string
  className?: string
}

export function Combobox({
  items,
  value,
  onValueChange,
  placeholder = "Select an option...",
  className,
}: ComboboxProps) {
  return (
    <select
      value={value || ""}
      onChange={(e) => onValueChange?.(e.target.value)}
      className={cn(
        "w-full bg-gray-700 border-gray-600 text-white rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500",
        className
      )}
    >
      <option value="">{placeholder}</option>
      {items.map((item) => (
        <option key={item.value} value={item.value}>
          {item.label}
        </option>
      ))}
    </select>
  )
}