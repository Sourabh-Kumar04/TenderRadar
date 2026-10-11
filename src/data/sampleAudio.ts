export interface SampleAudioItem {
  id: string;
  speciesName: string;
  scientificName: string;
  description: string;
  url: string;
  expectedClass: string;
}

export const SAMPLE_AUDIO_LIST: SampleAudioItem[] = [
  {
    id: 'sample-robin',
    speciesName: 'American Robin',
    scientificName: 'Turdus migratorius',
    description: 'Field recording, xeno-canto XC131093 (3s)',
    url: '/samples/american-robin.wav',
    expectedClass: 'Turdus migratorius_American Robin',
  },
  {
    id: 'sample-sparrow',
    speciesName: 'Song Sparrow',
    scientificName: 'Melospiza melodia',
    description: 'Field recording, xeno-canto XC131649 (3s)',
    url: '/samples/song-sparrow.wav',
    expectedClass: 'Melospiza melodia_Song Sparrow',
  },
  {
    id: 'sample-dove',
    speciesName: 'Mourning Dove',
    scientificName: 'Zenaida macroura',
    description: 'Field recording, xeno-canto XC128006 (3s)',
    url: '/samples/mourning-dove.wav',
    expectedClass: 'Zenaida macroura_Mourning Dove',
  },
  {
    id: 'sample-owl',
    speciesName: 'Barn Owl',
    scientificName: 'Tyto alba',
    description: 'Field recording, xeno-canto XC611957 (3s)',
    url: '/samples/barn-owl.wav',
    expectedClass: 'Tyto alba_Barn Owl',
  },
];
