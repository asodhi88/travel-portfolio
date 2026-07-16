import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import { useScroll, useReducedMotion } from '../lib/scroll.jsx'
import { cloudinaryImageUrl } from '../lib/cloudinary.js'

/* --------------------------------------------------------------------------
   Tuning. Deliberately gentle — the distortion should register as weight, not
   as an effect. Raise these to taste.
   -------------------------------------------------------------------------- */

// Scroll speed (px/frame) that counts as "full tilt". Velocity is normalised
// against this and clamped, so everything below is an amplitude at full tilt.
const MAX_VELOCITY = 55

// How fast the smoothed velocity chases the real one, per frame. Lower = more
// lag and less jitter.
const VELOCITY_LERP = 0.075

// Below this the plane is treated as flat, so it settles instead of creeping.
const VELOCITY_EPSILON = 0.0015

// Px the plane's horizontal centre leads its edges along the scroll axis.
const BEND_LEAD = 26

// Px the centre is pushed away from the camera. Reads as a shallow curve.
const BEND_DEPTH = 55

// Fractional elongation along the scroll axis.
const BEND_STRETCH = 0.045

// Distance from camera to the z=0 plane. Fixes the px-per-unit mapping and how
// strongly BEND_DEPTH foreshortens.
const PERSPECTIVE = 1000

const SEGMENTS_X = 32
const SEGMENTS_Y = 24

const TEXTURE_WIDTH = 1600

const vertexShader = /* glsl */ `
  uniform float uVelocity;
  uniform float uLead;
  uniform float uDepth;
  uniform float uStretch;

  varying vec2 vUv;

  const float PI = 3.141592653589793;

  void main() {
    vUv = uv;

    vec3 pos = position;

    // 0 at the plane's left and right edges, 1 at its horizontal centre.
    float arc = sin(uv.x * PI);

    // Elongate along the scroll axis, then let the centre lead the edges and
    // fall away from the camera. Together they read as a sheet of paper being
    // dragged through the viewport.
    pos.y *= 1.0 + abs(uVelocity) * uStretch;
    pos.y += arc * uVelocity * uLead;
    pos.z -= arc * abs(uVelocity) * uDepth;

    gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
  }
`

const fragmentShader = /* glsl */ `
  uniform sampler2D uTexture;
  uniform vec2 uPlaneSize;
  uniform vec2 uImageSize;
  uniform float uAlpha;

  varying vec2 vUv;

  void main() {
    // background-size: cover, in UV space. The photograph keeps its aspect
    // ratio and is centre-cropped to whatever box the DOM gave us.
    float planeAspect = uPlaneSize.x / uPlaneSize.y;
    float imageAspect = uImageSize.x / uImageSize.y;

    vec2 ratio = vec2(
      min(planeAspect / imageAspect, 1.0),
      min(imageAspect / planeAspect, 1.0)
    );

    vec2 uv = (vUv - 0.5) * ratio + 0.5;

    gl_FragColor = texture2D(uTexture, uv);

    // The texture is tagged sRGB, so sampling hands back linear values. A
    // ShaderMaterial doesn't get the renderer's output conversion injected for
    // free the way the built-in materials do — without this the photographs
    // render visibly dark.
    #include <colorspace_fragment>

    gl_FragColor.a *= uAlpha;
  }
`

const clamp = (v, min, max) => Math.min(Math.max(v, min), max)

/**
 * Renders each hero photograph as a textured plane on one full-viewport fixed
 * canvas, positioned to sit exactly where its (visually hidden) DOM <img>
 * sits.
 *
 * The DOM stays the source of truth: it does the layout, the measurement, the
 * links and the accessible names. This only paints. The canvas is
 * `pointer-events: none`, so a click on a plane lands on the real <a>
 * underneath it and routes to /photo/:slug the ordinary way.
 *
 * @param {{
 *   places: Array<{ slug: string, hero_image_url: string }>,
 *   imgRefs: React.MutableRefObject<Map<string, HTMLImageElement>>
 * }} props
 */
export default function WebGLStage({ places, imgRefs }) {
  const containerRef = useRef(null)
  const { subscribe, getLenis } = useScroll()
  const reducedMotion = useReducedMotion()

  // Read inside the frame loop, so toggling the OS setting doesn't rebuild the
  // scene.
  const reducedMotionRef = useRef(reducedMotion)
  reducedMotionRef.current = reducedMotion

  useEffect(() => {
    const container = containerRef.current
    if (!container) return undefined

    let disposed = false

    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
    })
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.outputColorSpace = THREE.SRGBColorSpace
    container.appendChild(renderer.domElement)

    const scene = new THREE.Scene()
    const camera = new THREE.PerspectiveCamera(50, 1, 1, PERSPECTIVE * 4)
    camera.position.z = PERSPECTIVE

    const maxAnisotropy = renderer.capabilities.getMaxAnisotropy()
    const loader = new THREE.TextureLoader()
    loader.setCrossOrigin('anonymous')

    /** Viewport-sized camera: 1 world unit at z=0 is 1 CSS px. */
    const sizeToViewport = () => {
      const w = window.innerWidth
      const h = window.innerHeight
      renderer.setSize(w, h)
      camera.aspect = w / h
      camera.fov = 2 * Math.atan(h / 2 / PERSPECTIVE) * (180 / Math.PI)
      camera.updateProjectionMatrix()
    }

    /** Lenis and the native fallback both scroll the window; ask Lenis first
        so we read the same value it is animating towards this frame. */
    const getScroll = () => getLenis()?.scroll ?? window.scrollY

    // One entry per place, in `places` order.
    const items = places
      .filter((place) => place.hero_image_url)
      .map((place) => {
        const material = new THREE.ShaderMaterial({
          vertexShader,
          fragmentShader,
          transparent: true,
          uniforms: {
            uTexture: { value: null },
            uPlaneSize: { value: new THREE.Vector2(1, 1) },
            uImageSize: { value: new THREE.Vector2(1, 1) },
            uAlpha: { value: 0 },
            uVelocity: { value: 0 },
            uLead: { value: BEND_LEAD },
            uDepth: { value: BEND_DEPTH },
            uStretch: { value: BEND_STRETCH },
          },
        })

        const mesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1, SEGMENTS_X, SEGMENTS_Y), material)
        mesh.frustumCulled = false
        mesh.visible = false
        scene.add(mesh)

        return {
          slug: place.slug,
          url: place.hero_image_url,
          mesh,
          material,
          texture: null,
          // Document-space box of the DOM <img>, in CSS px.
          rect: { top: 0, left: 0, width: 0, height: 0 },
        }
      })

    /* ---- measurement ------------------------------------------------------
       The DOM decides where every photograph goes; we just copy it. Measure in
       document space once per layout change, then each frame it's a single
       subtraction against the scroll offset — no per-frame getBoundingClientRect. */

    const measure = () => {
      const scroll = getScroll()

      for (const item of items) {
        const el = imgRefs.current.get(item.slug)
        if (!el) continue

        const box = el.getBoundingClientRect()
        const next = {
          top: box.top + scroll,
          left: box.left,
          width: box.width,
          height: box.height,
        }

        const resized =
          next.width !== item.rect.width || next.height !== item.rect.height

        item.rect = next

        if (resized && next.width > 0 && next.height > 0) {
          item.mesh.geometry.dispose()
          item.mesh.geometry = new THREE.PlaneGeometry(
            next.width,
            next.height,
            SEGMENTS_X,
            SEGMENTS_Y
          )
          item.material.uniforms.uPlaneSize.value.set(next.width, next.height)
        }
      }
    }

    /* ---- textures --------------------------------------------------------- */

    for (const item of items) {
      loader
        .loadAsync(cloudinaryImageUrl(item.url, TEXTURE_WIDTH))
        .then((texture) => {
          if (disposed) {
            texture.dispose()
            return
          }

          texture.colorSpace = THREE.SRGBColorSpace
          texture.anisotropy = maxAnisotropy
          texture.generateMipmaps = true
          texture.minFilter = THREE.LinearMipmapLinearFilter
          texture.magFilter = THREE.LinearFilter
          texture.needsUpdate = true

          item.texture = texture
          item.material.uniforms.uTexture.value = texture
          item.material.uniforms.uImageSize.value.set(
            texture.image.width,
            texture.image.height
          )
        })
        .catch(() => {
          // A photograph that won't load just stays absent from the canvas —
          // its DOM <img> keeps the layout and the alt text either way.
        })
    }

    /* ---- frame loop ------------------------------------------------------- */

    let smoothedVelocity = 0

    const frame = (velocity) => {
      if (disposed) return

      const target = reducedMotionRef.current
        ? 0
        : clamp(velocity / MAX_VELOCITY, -1, 1)

      smoothedVelocity += (target - smoothedVelocity) * VELOCITY_LERP
      if (Math.abs(smoothedVelocity) < VELOCITY_EPSILON) smoothedVelocity = 0

      const scroll = getScroll()
      const halfW = window.innerWidth / 2
      const halfH = window.innerHeight / 2

      for (const item of items) {
        const { rect, mesh, material } = item

        const ready = item.texture !== null && rect.width > 0 && rect.height > 0
        mesh.visible = ready
        if (!ready) continue

        mesh.position.x = rect.left + rect.width / 2 - halfW
        mesh.position.y = halfH - (rect.top - scroll + rect.height / 2)

        material.uniforms.uVelocity.value = smoothedVelocity
        material.uniforms.uAlpha.value = Math.min(
          material.uniforms.uAlpha.value + 0.06,
          1
        )
      }

      renderer.render(scene, camera)
    }

    /* ---- wiring ----------------------------------------------------------- */

    sizeToViewport()
    measure()

    const onResize = () => {
      sizeToViewport()
      measure()
    }
    window.addEventListener('resize', onResize)

    // Catches the photographs finishing their decode (and any reflow they
    // cause), which is what actually gives each <img> its box.
    const observer = new ResizeObserver(measure)
    for (const item of items) {
      const el = imgRefs.current.get(item.slug)
      if (el) observer.observe(el)
    }

    // The ScrollProvider already runs one rAF loop that steps Lenis and then
    // publishes velocity. Riding it keeps the planes on exactly the scroll
    // offset Lenis just wrote, with no second loop and no one-frame lag.
    const unsubscribe = subscribe(frame)

    return () => {
      disposed = true
      unsubscribe()
      observer.disconnect()
      window.removeEventListener('resize', onResize)

      for (const item of items) {
        item.mesh.geometry.dispose()
        item.material.dispose()
        item.texture?.dispose()
        scene.remove(item.mesh)
      }

      renderer.dispose()
      renderer.domElement.remove()
    }
  }, [places, imgRefs, subscribe, getLenis])

  return <div className="webgl-stage" ref={containerRef} aria-hidden="true" />
}
