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

// Px the plane's centre line leads its edges along the scroll axis.
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

// How grey the strips sit when nothing is pointing at them: 1 is fully
// desaturated, 0 is the photograph's own colour.
const REST_GREY = 1

// How fast a plane's colour chases hover on/off, per frame. Tuned to land near
// the 0.3s the CSS fallback uses.
const GREY_LERP = 0.12

const vertexShader = /* glsl */ `
  uniform float uVelocity;
  uniform float uLead;
  uniform float uDepth;
  uniform float uStretch;
  uniform float uHorizontal;

  varying vec2 vUv;

  const float PI = 3.141592653589793;

  void main() {
    vUv = uv;

    vec3 pos = position;

    // 0 at the plane's two edges across the scroll axis, 1 along its centre
    // line: the width for a vertical scroll, the height for a horizontal one.
    float arc = sin(mix(uv.x, uv.y, uHorizontal) * PI);

    float stretch = 1.0 + abs(uVelocity) * uStretch;
    float lead = arc * uVelocity * uLead;

    // Elongate along the scroll axis, then let the centre line lead the edges
    // and fall away from the camera. Together they read as a sheet of paper
    // being dragged through the viewport.
    //
    // A positive velocity drives the plane up the screen when scrolling
    // vertically but leftwards when scrolling horizontally, hence the flipped
    // sign — either way the centre runs ahead and the edges trail.
    pos.x = mix(pos.x, pos.x * stretch - lead, uHorizontal);
    pos.y = mix(pos.y * stretch + lead, pos.y, uHorizontal);
    pos.z -= arc * abs(uVelocity) * uDepth;

    gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
  }
`

const fragmentShader = /* glsl */ `
  uniform sampler2D uTexture;
  uniform vec2 uPlaneSize;
  uniform vec2 uImageSize;
  uniform float uAlpha;
  uniform float uGrey;

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

    // Desaturate after the sRGB conversion, not before: a CSS grayscale()
    // filter works on sRGB values, and the no-WebGL fallback is exactly that
    // filter. Do it in linear space instead and the two paths visibly disagree.
    //
    // These are the weights grayscale() itself uses — the saturate(0) matrix
    // from the Filter Effects spec — so the grey matches it rather than merely
    // resembling it.
    vec3 luma = vec3(dot(gl_FragColor.rgb, vec3(0.213, 0.715, 0.072)));
    gl_FragColor.rgb = mix(gl_FragColor.rgb, luma, uGrey);

    gl_FragColor.a *= uAlpha;
  }
`

const clamp = (v, min, max) => Math.min(Math.max(v, min), max)

/**
 * Renders each hero photograph as a textured plane on one full-viewport fixed
 * canvas, positioned to sit exactly where its (visually hidden) DOM strip sits.
 *
 * The DOM stays the source of truth: it does the layout, the measurement, the
 * links and the accessible names. This only paints. The canvas is
 * `pointer-events: none`, so a click on a plane lands on the real <a>
 * underneath it and routes to /photo/:slug the ordinary way — which is also why
 * hover can be read straight off the DOM.
 *
 * @param {{
 *   places: Array<{ slug: string, hero_image_url: string }>,
 *   stripRefs: React.MutableRefObject<Map<string, HTMLElement>>,
 *   hoveredRef: React.MutableRefObject<string | null>
 * }} props
 */
export default function WebGLStage({ places, stripRefs, hoveredRef }) {
  const containerRef = useRef(null)
  const { subscribe, getScroll, horizontal } = useScroll()
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
            uGrey: { value: REST_GREY },
            uVelocity: { value: 0 },
            uLead: { value: BEND_LEAD },
            uDepth: { value: BEND_DEPTH },
            uStretch: { value: BEND_STRETCH },
            uHorizontal: { value: horizontal ? 1 : 0 },
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
          // Box of the DOM strip in CSS px: document-space along the scroll
          // axis, viewport-space across it (where the two are the same thing,
          // because that axis never moves).
          rect: { top: 0, left: 0, width: 0, height: 0 },
          grey: REST_GREY,
        }
      })

    /* ---- measurement ------------------------------------------------------
       The DOM decides where every photograph goes; we just copy it. Measure
       once per layout change, then each frame it's a single subtraction against
       the scroll offset — no per-frame getBoundingClientRect. */

    const measure = () => {
      const scroll = getScroll()

      for (const item of items) {
        const el = stripRefs.current.get(item.slug)
        if (!el) continue

        const box = el.getBoundingClientRect()
        const next = {
          top: box.top + (horizontal ? 0 : scroll),
          left: box.left + (horizontal ? scroll : 0),
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
      const scrollX = horizontal ? scroll : 0
      const scrollY = horizontal ? 0 : scroll
      const halfW = window.innerWidth / 2
      const halfH = window.innerHeight / 2
      const hovered = hoveredRef.current

      for (const item of items) {
        const { rect, mesh, material } = item

        const ready = item.texture !== null && rect.width > 0 && rect.height > 0
        mesh.visible = ready
        if (!ready) continue

        mesh.position.x = rect.left - scrollX + rect.width / 2 - halfW
        mesh.position.y = halfH - (rect.top - scrollY + rect.height / 2)

        // Full colour under the pointer, grey everywhere else.
        const targetGrey = hovered === item.slug ? 0 : REST_GREY
        item.grey += (targetGrey - item.grey) * GREY_LERP
        material.uniforms.uGrey.value = item.grey

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

    // The strips are sized by CSS rather than by their contents, so this is
    // really just a second line of defence behind the resize listener — it
    // catches any relayout the window never hears about.
    const observer = new ResizeObserver(measure)
    for (const item of items) {
      const el = stripRefs.current.get(item.slug)
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
  }, [places, stripRefs, hoveredRef, subscribe, getScroll, horizontal])

  return <div className="webgl-stage" ref={containerRef} aria-hidden="true" />
}
