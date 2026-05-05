import { decimalToTimeString12h, dayOfYearToDateString } from '../utils/solarFormatUtils'

const MONTH_ABBR = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

function formatShortDate(dayOfYear) {
  const dateStr = dayOfYearToDateString(dayOfYear)
  const [, month, day] = dateStr.split('-').map(Number)
  return `${MONTH_ABBR[month - 1]} ${day}`
}

function formatLatLon(lat, lon) {
  const latStr = `${Math.abs(lat).toFixed(2)}° ${lat >= 0 ? 'N' : 'S'}`
  const lonStr = `${Math.abs(lon).toFixed(2)}° ${lon >= 0 ? 'E' : 'W'}`
  return `${latStr},  ${lonStr}`
}

// Composites a section/option header + solar info bar onto the bottom of a
// rendered scene capture. Used by DemoApp's batch-capture flow before
// downloading each image.
export function compositeInfoOverlay(blob, metadata) {
  return new Promise((resolve) => {
    const img = new Image()
    const url = URL.createObjectURL(blob)
    img.onload = () => {
      URL.revokeObjectURL(url)
      const canvas = document.createElement('canvas')
      canvas.width = img.width
      canvas.height = img.height
      const ctx = canvas.getContext('2d')
      ctx.drawImage(img, 0, 0)

      const barHeight = 130
      const barY = img.height - barHeight
      const padX = 72

      // Background bar
      ctx.fillStyle = 'rgba(0, 0, 0, 0.62)'
      ctx.fillRect(0, barY, img.width, barHeight)

      // Subtle top border
      ctx.fillStyle = 'rgba(255, 255, 255, 0.12)'
      ctx.fillRect(0, barY, img.width, 1)

      // Section name + selected option (option omitted for optionless sections)
      ctx.font = '600 62px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
      ctx.fillStyle = 'rgba(255, 255, 255, 0.95)'
      const headerText = metadata.optionLabel
        ? `${metadata.sectionLabel}  —  ${metadata.optionLabel}`
        : metadata.sectionLabel
      ctx.fillText(headerText, padX, barY + 66)

      // Solar info line — only rendered when the captured presentation supplies
      // all four solar fields. Skipped if missing, since the overlay must not
      // claim solar values the rendered image wasn't actually produced with.
      const hasSolarMetadata =
        typeof metadata.solarDayOfYear === 'number' &&
        typeof metadata.solarHour === 'number' &&
        typeof metadata.latitude === 'number' &&
        typeof metadata.longitude === 'number'
      if (hasSolarMetadata) {
        const date = formatShortDate(metadata.solarDayOfYear)
        const time = decimalToTimeString12h(metadata.solarHour)
        const latLon = formatLatLon(metadata.latitude, metadata.longitude)
        const solarLine = `Solar Date & Location:  ${date}  ·  ${time}  ·  ${latLon}`

        ctx.font = '400 40px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
        ctx.fillStyle = 'rgba(255, 255, 255, 0.65)'
        ctx.fillText(solarLine, padX, barY + 114)
      }

      canvas.toBlob((result) => resolve(result ?? blob), 'image/jpeg', 0.92)
    }
    img.onerror = () => { URL.revokeObjectURL(url); resolve(blob) }
    img.src = url
  })
}
