import type { CSSProperties } from 'react'

/** Profile background designs. The ids must match `User::BACKGROUND_TEMPLATES` in denuwe-ws. */
export const BACKGROUND_TEMPLATES = [
  {
    id: 'sky',
    name: 'Sky',
    style: { backgroundImage: 'linear-gradient(180deg, #c9defc 0%, #e6f0ff 45%, #f6f7fc 100%)' },
  },
  {
    id: 'aurora',
    name: 'Aurora',
    style: {
      backgroundColor: '#eef2fb',
      backgroundImage:
        'radial-gradient(60% 50% at 12% 8%, rgba(74,159,230,0.55), transparent 70%), radial-gradient(50% 45% at 88% 18%, rgba(168,85,247,0.4), transparent 70%), radial-gradient(70% 55% at 50% 100%, rgba(45,212,191,0.45), transparent 70%)',
    },
  },
  {
    id: 'sunset',
    name: 'Sunset',
    style: { backgroundImage: 'linear-gradient(160deg, #ffd6a5 0%, #ffb3b3 45%, #dcb8ff 100%)' },
  },
  {
    id: 'mint',
    name: 'Mint',
    style: { backgroundImage: 'linear-gradient(180deg, #c8f2df 0%, #e9faf2 50%, #f6f7fc 100%)' },
  },
  {
    id: 'lavender',
    name: 'Lavender',
    style: { backgroundImage: 'linear-gradient(180deg, #e2d7fb 0%, #f1ecfe 50%, #f6f7fc 100%)' },
  },
  {
    id: 'midnight',
    name: 'Midnight',
    style: {
      backgroundColor: '#0e1530',
      backgroundImage:
        'radial-gradient(1.5px 1.5px at 20px 30px, rgba(255,255,255,0.75), transparent), radial-gradient(1px 1px at 90px 120px, rgba(255,255,255,0.55), transparent), radial-gradient(1.5px 1.5px at 160px 70px, rgba(255,255,255,0.65), transparent), radial-gradient(1px 1px at 130px 170px, rgba(255,255,255,0.45), transparent), radial-gradient(90% 60% at 50% 0%, #22408a, transparent)',
      backgroundSize: '200px 200px, 200px 200px, 200px 200px, 200px 200px, 100% 100%',
    },
  },
  {
    id: 'dots',
    name: 'Dots',
    style: {
      backgroundColor: '#f4f7fd',
      backgroundImage: 'radial-gradient(rgba(42,107,214,0.24) 1.5px, transparent 1.7px)',
      backgroundSize: '18px 18px',
    },
  },
  {
    id: 'grid',
    name: 'Grid',
    style: {
      backgroundColor: '#f7f9fd',
      backgroundImage:
        'linear-gradient(rgba(42,107,214,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(42,107,214,0.1) 1px, transparent 1px)',
      backgroundSize: '28px 28px',
    },
  },
  {
    id: 'waves',
    name: 'Waves',
    style: {
      backgroundColor: '#ecf3ff',
      backgroundImage: 'repeating-radial-gradient(circle at 50% 115%, rgba(42,107,214,0.12) 0 2px, transparent 2px 24px)',
    },
  },
  {
    id: 'court',
    name: 'Court',
    style: {
      backgroundColor: '#2f8f5b',
      backgroundImage:
        'linear-gradient(90deg, transparent calc(50% - 2px), rgba(255,255,255,0.7) calc(50% - 2px) calc(50% + 2px), transparent calc(50% + 2px)), linear-gradient(transparent calc(50% - 1px), rgba(255,255,255,0.45) calc(50% - 1px) calc(50% + 1px), transparent calc(50% + 1px)), linear-gradient(160deg, #3aa36a, #276f48)',
    },
  },
] as const satisfies ReadonlyArray<{ id: string; name: string; style: CSSProperties }>

export type BackgroundTemplateId = (typeof BACKGROUND_TEMPLATES)[number]['id']

/** How your own background photo is shown. The ids must match `User::BACKGROUND_EFFECTS`. */
export const BACKGROUND_EFFECTS = [
  { id: 'natural', name: 'Natural' },
  { id: 'soft', name: 'Soft' },
  { id: 'frosted', name: 'Frosted' },
  { id: 'duotone', name: 'Duotone' },
  { id: 'dark', name: 'Dark' },
] as const

export type BackgroundEffect = (typeof BACKGROUND_EFFECTS)[number]['id']

export const DEFAULT_BACKGROUND_EFFECT: BackgroundEffect = 'soft'

export function templateStyle(id: string | null | undefined): CSSProperties | null {
  return BACKGROUND_TEMPLATES.find((t) => t.id === id)?.style ?? null
}

/** A chosen background, as the API returns it for a user. */
export type ProfileBackground = {
  background: string | null | undefined
  url?: string | null
  effect?: string | null
}

/** Whether there's anything to draw: a known template, or a photo that's been uploaded. */
export function hasBackground({ background, url }: ProfileBackground): boolean {
  return background === 'photo' ? Boolean(url) : templateStyle(background) !== null
}
