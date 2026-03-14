"use client"

import { useMemo, useState } from "react"
import { Clock3 } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { cn } from "@/lib/utils"

function parseTimeValue(value) {
  if (!value) return null

  const match = /^(\d{2}):(\d{2})/.exec(String(value))
  if (!match) return null

  return {
    hour: match[1],
    minute: match[2],
  }
}

function formatTimeLabel(value) {
  const parsed = parseTimeValue(value)
  if (!parsed) return ""

  const date = new Date(2000, 0, 1, Number(parsed.hour), Number(parsed.minute))
  return new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
  }).format(date)
}

function roundNow(minuteStep) {
  const now = new Date()
  let hours = now.getHours()
  let minutes = Math.round(now.getMinutes() / minuteStep) * minuteStep

  if (minutes === 60) {
    hours = (hours + 1) % 24
    minutes = 0
  }

  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`
}

function TimePicker({
  value,
  onChange,
  placeholder = "Pick a time",
  disabled = false,
  minuteStep = 5,
  className,
  buttonClassName,
  "aria-invalid": ariaInvalid,
}) {
  const parsed = useMemo(() => parseTimeValue(value), [value])
  const [open, setOpen] = useState(false)

  const hours = Array.from({ length: 24 }, (_, index) => String(index).padStart(2, "0"))
  const minutes = Array.from(
    { length: Math.ceil(60 / minuteStep) },
    (_, index) => String(index * minuteStep).padStart(2, "0")
  ).filter((item) => Number(item) < 60)

  const selectedHour = parsed?.hour || ""
  const selectedMinute = parsed?.minute || ""
  const triggerLabel = formatTimeLabel(value)

  return (
    <Popover open={open} onOpenChange={setOpen}>
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
          <Clock3 className="size-4 text-muted-foreground" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className={cn("w-[18rem] p-3", className)}>
        <div className="grid gap-3">
          <div className="grid gap-1">
            <div className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
              Hour
            </div>
            <Select
              value={selectedHour || "__none__"}
              onValueChange={(nextHour) => {
                if (nextHour === "__none__") {
                  onChange?.("")
                  return
                }

                onChange?.(`${nextHour}:${selectedMinute || "00"}`)
              }}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Hour" />
              </SelectTrigger>
              <SelectContent position="popper">
                <SelectItem value="__none__">Hour</SelectItem>
                {hours.map((hour) => (
                  <SelectItem key={hour} value={hour}>
                    {hour}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-1">
            <div className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
              Minute
            </div>
            <Select
              value={selectedMinute || "__none__"}
              onValueChange={(nextMinute) => {
                if (!selectedHour) return
                if (nextMinute === "__none__") {
                  onChange?.(`${selectedHour}:00`)
                  return
                }

                onChange?.(`${selectedHour}:${nextMinute}`)
              }}
              disabled={!selectedHour}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Minute" />
              </SelectTrigger>
              <SelectContent position="popper">
                <SelectItem value="__none__">Minute</SelectItem>
                {minutes.map((minute) => (
                  <SelectItem key={minute} value={minute}>
                    {minute}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="mt-3 flex items-center justify-between border-t border-border/60 pt-3">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => {
              onChange?.(roundNow(minuteStep))
              setOpen(false)
            }}>
            Now
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={!value}
            onClick={() => {
              onChange?.("")
              setOpen(false)
            }}>
            Clear
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  )
}

export { TimePicker, formatTimeLabel, parseTimeValue }
