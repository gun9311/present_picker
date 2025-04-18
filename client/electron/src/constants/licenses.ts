export interface LicenseEntry {
  type: "Sound" | "Image" | "Font" | "Library";
  name: string;
  source: string;
  license: string;
  url?: string;
}

export const licenses: LicenseEntry[] = [
  {
    type: "Sound",
    name: "Sound Effect (unspecified)", // 이름 구체화 추천
    source: "freesound_community - Pixabay",
    license: "Pixabay Content License", // 구체화 (출처 표기 필수 아님 명시 가능)
    url: "https://pixabay.com/sound-effects//?utm_source=link-attribution&utm_medium=referral&utm_campaign=music&utm_content=105867",
  },
  {
    type: "Image",
    name: "동전 아이콘",
    source: "NajmunNahar - Flaticon",
    license: "Flaticon Free License (Attribution Required)",
    url: "https://www.flaticon.com/kr/free-icons/",
  },
  {
    type: "Image",
    name: "유령 같은 아이콘",
    source: "Aranagraphics - Flaticon",
    license: "Flaticon Free License (Attribution Required)",
    url: "https://www.flaticon.com/kr/free-icons/-", // 링크 확인 필요
  },
  {
    type: "Image",
    name: "레이저 아이콘",
    source: "Freepik - Flaticon",
    license: "Flaticon License (see link)",
    url: "https://www.flaticon.com/kr/free-icons/",
  },
  {
    type: "Image",
    name: "블랙홀 아이콘",
    source: "Freepik - Flaticon",
    license: "Flaticon License (see link)",
    url: "https://www.flaticon.com/kr/free-icons/",
  },
  {
    type: "Image",
    name: "소행성 아이콘",
    source: "Umeicon - Flaticon",
    license: "Flaticon License (see link)",
    url: "https://www.flaticon.com/kr/free-icons/",
  },
  {
    type: "Image",
    name: "배터리 아이콘",
    source: "Freepik - Flaticon",
    license: "Flaticon Free License (Attribution Required)",
    url: "https://www.flaticon.com/kr/free-icons/-", // 링크 확인 필요
  },
  {
    type: "Image",
    name: "방패 아이콘",
    source: "Freepik - Flaticon",
    license: "Flaticon License (see link)",
    url: "https://www.flaticon.com/kr/free-icons/",
  },
];
