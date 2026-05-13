// Pure date/time formatting utilities used by the solar UI. Split out from
// solarUtils.js so importers (e.g. DemoApp) that only need formatting do not
// transitively pull in three.js — that would otherwise instantiate a second
// Three.js in any context that also loads the bundled Viewer (which has its
// own bundled Three.js), producing the "Multiple instances of Three.js"
// warning. Keep this file dependency-free.
export function timeStringToDecimal(timeStr) {
  const [hours, minutes] = timeStr.split(':').map(Number)
  return hours + minutes / 60
}

export function decimalToTimeString(value) {
  const hours = Math.floor(value)
  const minutes = Math.round((value - hours) * 60)

  const safeHours = String(hours).padStart(2, '0')
  const safeMinutes = String(minutes).padStart(2, '0')

  return `${safeHours}:${safeMinutes}`
}

export function decimalToTimeString12h(value) {
  const hours = Math.floor(value)
  const minutes = Math.round((value - hours) * 60)
  const period = hours < 12 ? 'am' : 'pm'
  const h12 = hours % 12 || 12
  return `${h12}:${String(minutes).padStart(2, '0')} ${period}`
}

export function dayOfYearToDateString(dayOfYear, year = new Date().getFullYear()) {
  const date = new Date(year, 0, dayOfYear)
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export function dateStringToDayOfYear(dateValue) {
  const [year, month, day] = dateValue.split('-').map(Number)
  const start = new Date(year, 0, 1)
  const current = new Date(year, month - 1, day)
  return Math.floor((current - start) / (24 * 60 * 60 * 1000)) + 1
}
