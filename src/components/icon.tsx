type IconProps = {
  name: string;
  className?: string;
};

export default function Icon({ name, className }: IconProps) {
  return (
    <span className={`icon material-symbols-outlined ${className ?? ''}`.trim()} aria-hidden="true">
      {name}
    </span>
  );
}
