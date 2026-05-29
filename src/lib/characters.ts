export type MascotName = "CHILI" | "FROSTY" | "ZAPPER" | "BOOMBA";

export interface CharacterDef {
  name: MascotName;
  label: string;
  color: string; // hex
  colorVar: string; // css var token name
  image: string;
  blurb: string;
}

export const CHARACTERS: Record<MascotName, CharacterDef> = {
  CHILI: {
    name: "CHILI",
    label: "칠리",
    color: "#FF4136",
    colorVar: "chili",
    image: "/characters/chili.png",
    blurb: "빨간 고추 전사",
  },
  FROSTY: {
    name: "FROSTY",
    label: "프로스티",
    color: "#0074D9",
    colorVar: "frosty",
    image: "/characters/frosty.png",
    blurb: "파란 눈덩이 로봇",
  },
  ZAPPER: {
    name: "ZAPPER",
    label: "재퍼",
    color: "#FFD700",
    colorVar: "zapper",
    image: "/characters/zapper.png",
    blurb: "노란 번개 도마뱀",
  },
  BOOMBA: {
    name: "BOOMBA",
    label: "붐바",
    color: "#B10DC9",
    colorVar: "boomba",
    image: "/characters/boomba.png",
    blurb: "보라 버섯 뚱보",
  },
};

export const MASCOT_ORDER: MascotName[] = ["CHILI", "FROSTY", "ZAPPER", "BOOMBA"];

export type ActionCardType =
  | "FORWARD_1"
  | "FORWARD_2"
  | "FORWARD_3"
  | "FALL_DOWN"
  | "TURN_AROUND"
  | "SWERVE"
  | "STAR";

export const ACTION_CARD_INFO: Record<
  ActionCardType,
  { label: string; desc: string; emoji: string }
> = {
  FORWARD_1: { label: "전진 1칸", desc: "지정 캐릭터를 1칸 전진", emoji: "🏃" },
  FORWARD_2: { label: "전진 2칸", desc: "지정 캐릭터를 2칸 전진", emoji: "🏃‍♂️" },
  FORWARD_3: { label: "전진 3칸", desc: "지정 캐릭터를 3칸 전진", emoji: "💨" },
  FALL_DOWN: { label: "넘어뜨리기", desc: "지정 캐릭터를 넘어짐 상태로", emoji: "💥" },
  TURN_AROUND: { label: "방향전환", desc: "180도 회전 후 역주행", emoji: "🔄" },
  SWERVE: { label: "차선변경", desc: "옆 레인으로 이동", emoji: "↔️" },
  STAR: { label: "스타!", desc: "결승선 직전 칸으로 순간이동", emoji: "⭐" },
};

export const TRACK_LENGTH = 10; // finish line position
export const LANE_COUNT = 4;

export const TEAM_COLORS = [
  "#FF4136",
  "#0074D9",
  "#FFD700",
  "#B10DC9",
  "#2ECC40",
  "#FF851B",
];
