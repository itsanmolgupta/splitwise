import { icons } from "lucide-react";

interface CategoryIconProps {
  iconName: string | null;
  color?: string | null;
  className?: string;
  size?: number;
}

const CategoryIcon = ({ iconName, color, className = "", size = 16 }: CategoryIconProps) => {
  if (!iconName) return null;

  // Convert kebab-case to PascalCase for lucide lookup
  const pascalName = iconName
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join("");

  const LucideIcon = (icons as Record<string, any>)[pascalName];
  if (!LucideIcon) return null;

  return (
    <LucideIcon
      size={size}
      className={className}
      style={color ? { color } : undefined}
    />
  );
};

export default CategoryIcon;
