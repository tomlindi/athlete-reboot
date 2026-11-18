// Backup-Datei speichern. Auf dem iPhone öffnet sich das Teilen-Menü
// („In Dateien sichern“, AirDrop …), sonst wird die Datei heruntergeladen.

export async function saveJsonFile(
  fileName: string,
  data: unknown,
  title = 'Athlete Reboot Backup',
): Promise<'shared' | 'downloaded' | 'cancelled'> {
  const text = JSON.stringify(data, null, 2)
  const file = new File([text], fileName, { type: 'application/json' })

  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title })
      return 'shared'
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return 'cancelled'
      // Sonst auf Download ausweichen
    }
  }

  const url = URL.createObjectURL(file)
  const a = document.createElement('a')
  a.href = url
  a.download = fileName
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
  return 'downloaded'
}

export function readTextFile(file: File): Promise<string> {
  return file.text()
}
