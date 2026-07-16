/**
 * Whether this browser can give us a WebGL context at all. Called once, before
 * the first render, so the carousel can decide between the WebGL stage and the
 * plain DOM images.
 */
export function isWebGLAvailable() {
  try {
    const canvas = document.createElement('canvas')
    return Boolean(
      window.WebGLRenderingContext &&
        (canvas.getContext('webgl2') || canvas.getContext('webgl'))
    )
  } catch {
    return false
  }
}
