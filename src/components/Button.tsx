type Variant = "primary" | "ghost" | "danger";

const STYLES: Record<Variant, string> = {
  primary: "bg-amber-400 text-neutral-900 hover:bg-amber-300 shadow",
  ghost: "bg-white/10 text-parchment hover:bg-white/20 ring-1 ring-white/15",
  danger: "bg-red-500/85 text-white hover:bg-red-500",
};

export function Button({
  variant = "ghost", className = "", ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  return (
    <button
      {...rest}
      className={`rounded-md px-3 py-1.5 font-display text-[0.8rem] font-semibold
                  transition-colors disabled:cursor-not-allowed disabled:opacity-35
                  ${STYLES[variant]} ${className}`}
    />
  );
}
