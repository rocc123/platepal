const IMAGE_EXTENSIONS = new Set(['jpg', 'jpeg', 'png', 'webp', 'gif', 'heic', 'heif', 'bmp', 'avif'])

export function imageExtension(name: string) {
  const base = name.split(/[/\\]/).pop() ?? name
  const dot = base.lastIndexOf('.')
  if (dot <= 0 || dot === base.length - 1) return ''
  return base.slice(dot + 1).toLowerCase()
}

/** Phone camera rolls often omit a MIME type or send HEIC as octet-stream. */
export function isImageFile(file: { type: string; name: string }) {
  const type = file.type.trim().toLowerCase()
  if (type.startsWith('image/')) return true
  const ext = imageExtension(file.name)
  if (!IMAGE_EXTENSIONS.has(ext)) return false
  return type === '' || type === 'application/octet-stream'
}
