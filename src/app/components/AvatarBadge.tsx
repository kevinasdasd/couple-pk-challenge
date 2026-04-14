import type { AvatarOption } from "../utils/avatarOptions";

interface AvatarBadgeProps {
  avatar: AvatarOption;
  alt: string;
  emojiClassName?: string;
}

export function AvatarBadge({ avatar, alt, emojiClassName = "" }: AvatarBadgeProps) {
  if (avatar.imageSrc) {
    return <img src={avatar.imageSrc} alt={alt} className="h-full w-full rounded-full object-cover" draggable={false} />;
  }

  return <span className={emojiClassName}>{avatar.emoji}</span>;
}
