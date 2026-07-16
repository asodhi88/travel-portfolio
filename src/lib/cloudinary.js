// Cloudinary unsigned upload helper.
// Uses an unsigned upload preset so no API secret is needed in the browser.
const CLOUD_NAME = 'btroy1qm'
const UPLOAD_PRESET = 'portfolio_uploads'
const UPLOAD_URL = `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`

/**
 * Insert a delivery transformation into a Cloudinary image URL.
 *
 * Both the DOM <img> and the WebGL texture request the exact same URL, so the
 * photograph is downloaded and decoded once and served from cache the second
 * time.
 *
 * Non-Cloudinary URLs are returned untouched.
 *
 * @param {string} url    a Cloudinary secure_url
 * @param {number} width  target width in px
 */
export function cloudinaryImageUrl(url, width = 1600) {
  if (!url) return url

  const marker = '/image/upload/'
  const at = url.indexOf(marker)
  if (at === -1) return url

  const head = url.slice(0, at + marker.length)
  const tail = url.slice(at + marker.length)
  return `${head}w_${width},q_auto,f_auto/${tail}`
}

/**
 * Upload a single file to Cloudinary, reporting progress.
 * @param {File} file
 * @param {(percent: number) => void} onProgress  called with 0-100
 * @returns {Promise<string>} the secure_url of the uploaded image
 */
export function uploadToCloudinary(file, onProgress) {
  return new Promise((resolve, reject) => {
    const form = new FormData()
    form.append('file', file)
    form.append('upload_preset', UPLOAD_PRESET)

    // XMLHttpRequest is used (instead of fetch) because it exposes upload progress.
    const xhr = new XMLHttpRequest()
    xhr.open('POST', UPLOAD_URL)

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && onProgress) {
        onProgress(Math.round((e.loaded / e.total) * 100))
      }
    }

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          const res = JSON.parse(xhr.responseText)
          resolve(res.secure_url)
        } catch (err) {
          reject(new Error('Failed to parse Cloudinary response'))
        }
      } else {
        reject(new Error(`Cloudinary upload failed (${xhr.status})`))
      }
    }

    xhr.onerror = () => reject(new Error('Network error during Cloudinary upload'))
    xhr.send(form)
  })
}
