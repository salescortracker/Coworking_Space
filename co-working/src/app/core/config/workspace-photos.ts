/**
 * Photo catalogue for every workspace image in Officera.
 *
 * Mock data refers to images by a numeric "photo seed" (Location.photos, Resource.photos,
 * Event/BlogPost.imageSeed, GalleryItem.seed). This file maps each seed to a real photograph
 * and its alt text, so the data layer stays unchanged and images can later come from the API
 * (e.g. a CDN URL on the location record) by swapping `photoUrl()`.
 *
 * Seed ranges:
 *   1–6      site-wide (defaults, homepage hero, sign-in, about)
 *   X1–X5    location X: X1 open floor / hot desks · X2 dedicated desks · X3 private office
 *            X4 meeting room · X5 lounge or café   (X = 1…5 → LOC-001…LOC-005)
 *   61–67    community events · 71–75 blog posts · 80–91 public gallery
 *
 * Photos are free-licence images served from the Unsplash CDN, which resizes and converts them
 * (WebP/AVIF) on the fly for the requested width.
 */
export interface WorkspacePhoto {
  /** Unsplash photo id (the part after `photo-`). */
  id: string;
  alt: string;
}

const PHOTOS: Record<number, [id: string, alt: string]> = {
  1: ['1562664377-709f2c337eb2', 'Bright coworking space with plants and open seating'],
  2: ['1560821648-a31f6ddaa9a8', 'Coworking space with communal tables and pendant lights'],
  3: ['1790944338750-c9865b942b16', 'Modern office lobby with floor-to-ceiling windows'],
  5: ['1600508774634-4e11d34730e2', 'Premium coworking floor with lounge seating and workstations'],
  6: ['1578991624414-276ef23a534f', 'Officera reception and welcome area'],

  // LOC-001 · HITEC City
  11: ['1562664348-2188b99b5157', 'Open coworking floor with hot desks'],
  12: ['1594235048794-fae8583a5af5', 'Dedicated desks beside a living green wall'],
  13: ['1656646424763-145e4956a416', 'Glass-walled private office with desk and chair'],
  14: ['1431540015161-0bf868a2d407', 'Meeting room with a long table and city views'],
  15: ['1774186184495-dc059ef40c75', 'Member lounge with sofas and soft lighting'],
  // LOC-002 · Jubilee Hills
  21: ['1594125674965-70d796b6693f', 'Hot-desking area with shared tables'],
  22: ['1572521165329-b197f9ea3da6', 'Row of dedicated desks with monitors'],
  23: ['1637665627832-dcd730049fbb', 'Private cabin with glass partitions'],
  24: ['1571624436279-b272aff752b5', 'Meeting room with wooden table and screen'],
  // LOC-003 · Koramangala
  31: ['1770816307817-2fa6131e3a9b', 'Open workspace with long shared tables'],
  32: ['1560264280-88b68371db39', 'Dedicated desk zone in a bright open-plan office'],
  33: ['1770048532712-4fde5ef7eb90', 'Private office pod inside a coworking floor'],
  34: ['1582653291997-079a1c04e5a1', 'Conference room set for a team meeting'],
  35: ['1576497534111-ecb67bdf74ca', 'Café and break area with communal seating'],
  // LOC-004 · Whitefield
  41: ['1604328699206-5f24c5ed8dd4', 'Open-plan coworking floor with workstations'],
  42: ['1780733066623-73944b8a0f8f', 'Fixed workstations in a quiet office zone'],
  43: ['1746021375246-7dc8ab0583f0', 'Team office with glass walls and plants'],
  44: ['1462826303086-329426d1aef5', 'Boardroom with a long conference table'],
  // LOC-005 · OMR
  51: ['1774186184383-90fc06307e77', 'Hot desks by floor-to-ceiling windows'],
  52: ['1700809887584-0798672b1d48', 'Dedicated desks with storage in an open office'],
  53: ['1551834317-9ddfd4ec7069', 'Private office suite with desks for a small team'],
  54: ['1560264401-b76ed96f3134', 'Meeting room with round table and display'],

  // Events
  61: ['1563461661026-49631dd5d68e', 'Members networking at a community breakfast'],
  62: ['1591115765373-5207764f72e7', 'Workshop session with a presenter and audience'],
  63: ['1677188010559-0667a1ed33a0', 'Members playing a board game together'],
  64: ['1560439514-e960a3ef5019', 'Founder presenting on stage at demo day'],
  65: ['1764661441867-473a59a765bc', 'Group yoga session in a bright studio'],
  66: ['1505373877841-8d25f7d46678', 'Tech talk with slides on a large screen'],
  67: ['1557804506-669a67965ba0', 'Designers discussing ideas at a whiteboard'],

  // Blog
  71: ['1596749853719-e6aa1dc2eabe', 'Mix of hot desks and dedicated desks'],
  72: ['1568992688065-536aad8a12f6', 'Hybrid team working together at a shared table'],
  73: ['1707902665498-a202981fb5ac', 'Reviewing invoices with a calculator'],
  74: ['1559523161-0fc0d8b38a7a', 'Two people recording in a podcast studio'],
  75: ['1556761175-b413da4baf72', 'Team collaborating during an offsite session'],

  // Gallery
  80: ['1655746340587-9d1aaad92b6d', 'Open workspace with indoor trees and natural light'],
  81: ['1745920770891-b46fc1799646', 'Boardroom with a long table for large meetings'],
  82: ['1768508663341-ed48fd1e69d8', 'Community event in the coworking space'],
  83: ['1631249073981-35567d93a0d1', 'Pantry and lounge with kitchen counter'],
  84: ['1765366417060-78ab27464ad4', 'Focus zone with window bar seating'],
  85: ['1661169399398-dd271af8f651', 'Huddle room for small team meetings'],
  86: ['1675716921224-e087a0cca69a', 'Founders meetup conversation'],
  87: ['1594235045856-a6315f0c4083', 'Soundproof phone booths for private calls'],
  88: ['1746021375306-9dec0f637732', 'Private cabin with glass door'],
  89: ['1721448288287-6dc6ce150e40', 'Rooftop terrace with outdoor seating'],
  90: ['1720193018438-4f77b904e9d4', 'Demo day presentation to a full room'],
  91: ['1758448500688-3ababa93fd67', 'Reception desk and visitor lobby'],
};

/** Workspace interiors used for seeds with no dedicated photo (new locations, uploads in the mockup). */
const FALLBACK_SEEDS = [11, 21, 31, 41, 51, 12, 22, 32, 42, 52, 13, 23, 33, 43, 53, 14, 24, 34, 44, 54, 1, 2, 80, 84];

/** Responsive widths requested from the image CDN. */
export const PHOTO_WIDTHS = [400, 800, 1200, 1600];

export function workspacePhoto(seed: number): WorkspacePhoto {
  const entry = PHOTOS[seed] ?? PHOTOS[FALLBACK_SEEDS[Math.abs(Math.trunc(seed)) % FALLBACK_SEEDS.length]];
  return { id: entry[0], alt: entry[1] };
}

export function photoUrl(photo: WorkspacePhoto, width: number): string {
  return `https://images.unsplash.com/photo-${photo.id}?auto=format&fit=crop&w=${width}&q=70`;
}

export function photoSrcset(photo: WorkspacePhoto): string {
  return PHOTO_WIDTHS.map((w) => `${photoUrl(photo, w)} ${w}w`).join(', ');
}
