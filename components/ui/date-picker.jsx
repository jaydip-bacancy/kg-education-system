"use client"

import { useMemo, useState } from "react"
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { cn } from "@/lib/utils"

const WEEKDAYS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"]

function parseDateValue(value) {
  if (!value) return null

  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value))
  if (!match) return null

  const year = Number(match[1])
  const month = Number(match[2]) - 1
  const day = Number(match[3])
  const date = new Date(year, month, day)

  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month ||
    date.getDate() !== day
  ) {
    return null
  }

  return date
}

function formatDateValue(date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, "0")
  const day = String(date.getDate()).padStart(2, "0")
  return `${year}-${month}-${day}`
}

function startOfMonth(date) {
  return new Date(date.getFullYear(), date.getMonth(), 1)
}

function shiftMonth(date, offset) {
  return new Date(date.getFullYear(), date.getMonth() + offset, 1)
}

function isSameDay(left, right) {
  return (
    left.getFullYear() === right.getFullYear() &&
    left.getMonth() === right.getMonth() &&
    left.getDate() === right.getDate()
  )
}

function buildMonthGrid(month) {
  const firstDay = startOfMonth(month)
  const firstWeekday = firstDay.getDay()
  const gridStart = new Date(firstDay)
  gridStart.setDate(firstDay.getDate() - firstWeekday)

  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(gridStart)
    date.setDate(gridStart.getDate() + index)
    return {
      date,
      inMonth: date.getMonth() === month.getMonth(),
    }
  })
}

function formatTriggerLabel(value) {
  const parsed = parseDateValue(value)
  if (!parsed) return ""

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(parsed)
}

function formatMonthLabel(date) {
  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    year: "numeric",
  }).format(date)
}

function DatePicker({
  value,
  onChange,
  placeholder = "Pick a date",
  disabled = false,
  className,
  buttonClassName,
  "aria-invalid": ariaInvalid,
}) {
  const selectedDate = useMemo(() => parseDateValue(value), [value])
  const [open, setOpen] = useState(false)
  const [visibleMonthOverride, setVisibleMonthOverride] = useState(null)

  const baseMonth = selectedDate ? startOfMonth(selectedDate) : startOfMonth(new Date())
  const visibleMonth = visibleMonthOverride || baseMonth
  const days = useMemo(() => buildMonthGrid(visibleMonth), [visibleMonth])
  const today = useMemo(() => {
    const now = new Date()
    return new Date(now.getFullYear(), now.getMonth(), now.getDate())
  }, [])
  const triggerLabel = formatTriggerLabel(value)

  return (
    <Popover
      open={open}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen)
        if (!nextOpen) setVisibleMonthOverride(null)
      }}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          disabled={disabled}
          aria-invalid={ariaInvalid}
          className={cn(
            "w-full justify-between bg-transparent px-3 font-normal",
            !triggerLabel && "text-muted-foreground",
            buttonClassName
          )}>
          <span className="truncate">{triggerLabel || placeholder}</span>
          <CalendarDays className="size-4 text-muted-foreground" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className={cn("w-[18rem] p-3", className)}>
        <div className="flex items-center justify-between gap-2">
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            onClick={() => setVisibleMonthOverride(shiftMonth(visibleMonth, -1))}>
            <ChevronLeft className="size-4" />
          </Button>
          <div className="text-sm font-semibold text-foreground">
            {formatMonthLabel(visibleMonth)}
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            onClick={() => setVisibleMonthOverride(shiftMonth(visibleMonth, 1))}>
            <ChevronRight className="size-4" />
          </Button>
        </div>

        <div className="mt-3 grid grid-cols-7 gap-1 text-center text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
          {WEEKDAYS.map((weekday) => (
            <div key={weekday} className="py-1">
              {weekday}
            </div>
          ))}
        </div>

        <div className="mt-2 grid grid-cols-7 gap-1">
          {days.map(({ date, inMonth }) => {
            const isSelected = selectedDate ? isSameDay(date, selectedDate) : false
            const isToday = isSameDay(date, today)

            return (
              <Button
                key={formatDateValue(date)}
                type="button"
                variant={isSelected ? "default" : "ghost"}
                size="icon-sm"
                className={cn(
                  "h-9 w-full rounded-md p-0 font-normal",
                  !inMonth && "text-muted-foreground/45",
                  isToday && !isSelected && "border border-border/70"
                )}
                onClick={() => {
                  onChange?.(formatDateValue(date))
                  setOpen(false)
                  setVisibleMonthOverride(null)
                }}>
                {date.getDate()}
              </Button>
            )
          })}
        </div>

        <div className="mt-3 flex items-center justify-between border-t border-border/60 pt-3">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => {
              onChange?.(formatDateValue(new Date()))
              setOpen(false)
              setVisibleMonthOverride(null)
            }}>
            Today
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={!value}
            onClick={() => {
              onChange?.("")
              setOpen(false)
              setVisibleMonthOverride(null)
            }}>
            Clear
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  )
}

export { DatePicker, formatDateValue, parseDateValue }
