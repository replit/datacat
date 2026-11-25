import type { ComponentProps, ReactNode } from "react";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { CircleAlert, Info } from "lucide-react";

export const cn = (...classes: ClassValue[]) => twMerge(clsx(classes));

const buttonVariants = {
  primary: "bg-primary-700 text-white hover:bg-primary-800 active:bg-primary-900",
  outline: "border border-line-strong bg-white text-ink hover:bg-subtle",
  secondary: "bg-subtle text-ink hover:bg-line active:bg-line-strong",
  ghost: "text-ink-2 hover:bg-subtle hover:text-ink",
  destructive: "bg-alert text-white hover:bg-alert/90",
  link: "text-primary underline-offset-4 hover:underline px-0 h-auto",
  dark: "bg-neutral-950 text-white hover:bg-neutral-800",
};
const buttonSizes = {
  sm: "h-7 px-2.5 text-[13px] gap-1.5 [&_svg]:size-3.5",
  md: "h-8 px-3.5 text-[13px] gap-1.5 [&_svg]:size-4",
  lg: "h-10 px-5 text-sm gap-2 [&_svg]:size-4",
  icon: "size-8 [&_svg]:size-4",
};
export type ButtonVariant = keyof typeof buttonVariants;
export type ButtonSize = keyof typeof buttonSizes;

export function buttonStyles({ variant = "secondary", size = "md", className }: { variant?: ButtonVariant; size?: ButtonSize; className?: string } = {}) {
  return cn(
    "inline-flex items-center justify-center rounded-md font-medium whitespace-nowrap transition-colors outline-none focus-visible:ring-2 focus-visible:ring-brand-400 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:shrink-0",
    buttonSizes[size],
    buttonVariants[variant],
    className,
  );
}

export const fieldStyles = ({ className }: { className?: string } = {}) =>
  cn(
    "h-[30px] px-2.5 rounded-md border border-line-strong bg-white text-[13px] text-ink placeholder:text-ink-3 outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-brand-200 aria-invalid:border-alert aria-invalid:focus:border-alert aria-invalid:focus:ring-alert/20 disabled:bg-panel disabled:opacity-60",
    className,
  );

export const cardStyles = ({ className }: { className?: string } = {}) => cn("bg-white border border-line rounded-lg", className);

const badgeTones = {
  neutral: "bg-subtle border-line text-ink-2",
  brand: "bg-brand-100 border-brand-200 text-primary",
};
export const badgeStyles = ({ tone = "neutral", className }: { tone?: keyof typeof badgeTones; className?: string } = {}) =>
  cn("inline-flex items-center gap-1 px-1.5 h-5 rounded border text-[11px] whitespace-nowrap", badgeTones[tone], className);

export const labelStyles = ({ className }: { className?: string } = {}) => cn("text-[11px] font-semibold text-ink-2 uppercase tracking-wide", className);
export const sectionTitleStyles = ({ className }: { className?: string } = {}) => cn("text-[15px] font-semibold text-ink", className);

export const tableStyles = ({ className }: { className?: string } = {}) =>
  cn(
    "w-full text-[13px]",
    "[&_th]:text-left [&_th]:font-semibold [&_th]:text-ink [&_th]:text-[11px] [&_th]:uppercase [&_th]:tracking-[0.03em] [&_th]:px-3 [&_th]:h-8 [&_th]:border-b [&_th]:border-line [&_th]:bg-white [&_th]:whitespace-nowrap [&_th]:select-none",
    "[&_td]:px-3 [&_td]:h-[34px] [&_td]:border-b [&_td]:border-line [&_td]:align-middle [&_tbody_tr:hover]:bg-brand-50",
    className,
  );

export function Button({ variant, size, className, ...props }: ComponentProps<"button"> & { variant?: ButtonVariant; size?: ButtonSize }) {
  return <button className={buttonStyles({ variant, size, className })} {...props} />;
}
export const Input = ({ className, ...props }: ComponentProps<"input">) => <input className={fieldStyles({ className })} {...props} />;
export const Select = ({ className, ...props }: ComponentProps<"select">) => <select className={fieldStyles({ className })} {...props} />;
export const Textarea = ({ className, ...props }: ComponentProps<"textarea">) => (
  <textarea className={fieldStyles({ className: cn("h-auto py-1.5", className) })} {...props} />
);

export function Field({
  id,
  label,
  error,
  description,
  children,
}: {
  id: string;
  label: string;
  error?: string;
  description?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5" data-invalid={error ? true : undefined}>
      <label htmlFor={id} className={cn("text-[13px] font-medium text-ink", error && "text-alert")}>
        {label}
      </label>
      {children}
      {error ? (
        <p id={`${id}-error`} className="text-[12px] text-alert">
          {error}
        </p>
      ) : (
        description && <p className="text-[12px] text-ink-3">{description}</p>
      )}
    </div>
  );
}

export function Alert({ tone = "error", children }: { tone?: "error" | "info"; children: ReactNode }) {
  const Icon = tone === "error" ? CircleAlert : Info;
  return (
    <div
      role={tone === "error" ? "alert" : "status"}
      className={cn(
        "flex items-center gap-2 rounded-md border px-3 py-2.5 text-left text-[13px] leading-snug",
        tone === "error" ? "border-alert/30 bg-alert/10 text-alert" : "border-brand-200 bg-brand-100 text-ink",
      )}
    >
      <Icon size={16} className="shrink-0" />
      <div>{children}</div>
    </div>
  );
}
