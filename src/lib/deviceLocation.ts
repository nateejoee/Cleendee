export const MAX_PIN_ERROR_METERS = 10

export type DeviceFix = { point: [number, number]; accuracy: number }
export type LocationResult = 'ready' | 'denied' | 'unavailable' | 'timeout' | 'imprecise'

/** Collect a short burst of fresh readings while the customer is placing a pin. */
export function readDeviceLocation(
  device: Geolocation,
  onFix: (fix: DeviceFix) => void,
  onFinish: (result: LocationResult) => void,
) {
  const started = Date.now()
  let best = Infinity
  let active = true
  let watch: number | undefined
  const timer = setTimeout(() => finish(best < Infinity ? 'imprecise' : 'timeout'), 25000)

  function stop() {
    active = false
    clearTimeout(timer)
    if (watch !== undefined) device.clearWatch(watch)
  }
  function finish(result: LocationResult) {
    if (!active) return
    stop()
    onFinish(result)
  }
  try {
    watch = device.watchPosition(position => {
      const { latitude, longitude, accuracy } = position.coords
      if (!active || position.timestamp < started || !Number.isFinite(accuracy) || accuracy <= 0 || accuracy >= best ||
        !Number.isFinite(latitude) || Math.abs(latitude) > 90 || !Number.isFinite(longitude) || Math.abs(longitude) > 180) return
      best = accuracy
      if (accuracy > MAX_PIN_ERROR_METERS) return
      onFix({ point: [latitude, longitude], accuracy })
      finish('ready')
    }, error => {
      if (error.code === 1) finish('denied')
      else if (error.code === 3) finish(best < Infinity ? 'imprecise' : 'timeout')
      // A temporarily unavailable sensor may deliver another fix before the deadline.
    }, { enableHighAccuracy: true, maximumAge: 0, timeout: 25000 })
    if (!active) device.clearWatch(watch)
  } catch {
    finish('unavailable')
  }
  return stop
}
