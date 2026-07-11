// Cloudinary unsigned upload helper.
// Uses an unsigned upload preset so no API secret is needed in the browser.
const CLOUD_NAME = 'btroy1qm'
const UPLOAD_PRESET = 'portfolio_uploads'
const UPLOAD_URL = `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`

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
