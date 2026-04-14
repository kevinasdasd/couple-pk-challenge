export interface AvatarOption {
  id: string;
  emoji: string;
  solid: string;
  soft: string;
  imageSrc?: string;
}

export const AVATAR_OPTIONS: AvatarOption[] = [
  { id: "avatar-1", emoji: "🦁", solid: "#FFEA6F", soft: "#FFF7C9", imageSrc: "/images/avatars/jiyibaobao.jpg" },
  { id: "avatar-2", emoji: "🐼", solid: "#FFC9EF", soft: "#FFE6F7", imageSrc: "/images/avatars/wusaqi.jpg" },
  { id: "avatar-3", emoji: "🐸", solid: "#ABD7FA", soft: "#E4F3FF", imageSrc: "/images/avatars/xiaobamao.jpg" },
  { id: "avatar-4", emoji: "🐻", solid: "#FFEA6F", soft: "#FFF4BA" },
  { id: "avatar-5", emoji: "🐯", solid: "#FFC9EF", soft: "#FFE8F8" },
  { id: "avatar-6", emoji: "🐰", solid: "#ABD7FA", soft: "#EAF5FF" },
  { id: "avatar-7", emoji: "🦊", solid: "#FFEA6F", soft: "#FFF7CD" },
  { id: "avatar-8", emoji: "🐨", solid: "#FFC9EF", soft: "#FFE4F6" },
  { id: "avatar-9", emoji: "🐶", solid: "#ABD7FA", soft: "#E8F4FD" },
];

export function getAvatarOptionById(avatarId: string, fallbackIndex = 0) {
  return AVATAR_OPTIONS.find((avatar) => avatar.id === avatarId) ?? AVATAR_OPTIONS[fallbackIndex] ?? AVATAR_OPTIONS[0];
}
