import { TRADITIONAL_TO_SIMPLIFIED } from '../data/traditionalToSimplified.generated';

/** Character-preserving conversion so source offsets remain stable. */
export function simplifyChinese(text: string) {
  let converted = '';
  for (const character of text) converted += TRADITIONAL_TO_SIMPLIFIED[character] || character;
  return converted;
}
