import { cn } from "@/lib/utils";

type Props = {
  firstName: string;
  lastName: string | null;
  photoUrl: string | null;
  size?: "sm" | "md" | "lg";
  className?: string;
};

export function ChatAvatar({ firstName, lastName, photoUrl, size = "md", className }: Props) {
  const sizeClass = {
    sm: "h-8 w-8 text-xs",
    md: "h-10 w-10 text-sm",
    lg: "h-12 w-12 text-base",
  }[size];

  const initials =
    [firstName?.[0], lastName?.[0]].filter(Boolean).join("").toUpperCase() || "?";

  if (photoUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={photoUrl}
        alt=""
        className={cn(
          "shrink-0 rounded-full object-cover",
          sizeClass,
          className,
        )}
      />
    );
  }

  return (
    <span
      className={cn(
        "flex shrink-0 items-center justify-center rounded-full bg-[#e6ecf2] font-medium text-[#3a4352]",
        sizeClass,
        className,
      )}
    >
      {initials}
    </span>
  );
}
