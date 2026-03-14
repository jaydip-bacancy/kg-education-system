"use client"

import { DatePicker } from "@/components/ui/date-picker"
import { TimePicker } from "@/components/ui/time-picker"
import { cn } from "@/lib/utils"

function splitDateTimeValue(value) {
  if (!value) {
    return { dateValue: "", timeValue: "" }
  }

  const [dateValue = "", timePart = ""] = String(value).split("T")
  return {
    dateValue,
    timeValue: timePart.slice(0, 5),
  }
}

function combineDateTimeValue(dateValue, timeValue) {
  if (!dateValue) return ""
  return `${dateValue}T${timeValue || "00:00"}`
}

function DateTimePicker({
  value,
  onChange,
  disabled = false,
  className,
  dateButtonClassName,
  timeButtonClassName,
}) {
  const { dateValue, timeValue } = splitDateTimeValue(value)

  return (
    <div className={cn("grid gap-2 sm:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]", className)}>
      <DatePicker
        value={dateValue}
        onChange={(nextDate) => onChange?.(combineDateTimeValue(nextDate, timeValue))}
        placeholder="Pick a date"
        disabled={disabled}
        buttonClassName={dateButtonClassName}
      />
      <TimePicker
        value={timeValue}
        onChange={(nextTime) => onChange?.(combineDateTimeValue(dateValue, nextTime))}
        placeholder="Pick a time"
        disabled={disabled || !dateValue}
        buttonClassName={timeButtonClassName}
      />
    </div>
  )
}

export { DateTimePicker, combineDateTimeValue, splitDateTimeValue }
