"use client";

import { useFormStatus } from "react-dom";
import * as stylex from "@stylexjs/stylex";
import { base_styles } from "@/src/lib/styles";

type SubmitButtonProps = {
  children: React.ReactNode;
  confirmMessage?: string;
  disabled?: boolean;
  disabledLabel?: string;
  pendingLabel: string;
  variant?: "primary" | "secondary" | "danger";
};

export function SubmitButton({ children, confirmMessage, disabled = false, disabledLabel, pendingLabel, variant = "primary" }: SubmitButtonProps) {
  const { pending } = useFormStatus();
  const isDisabled = disabled || pending;

  return (
    <button
      {...stylex.props(
        base_styles.button,
        variant === "secondary" && base_styles.button_secondary,
        variant === "danger" && base_styles.button_danger,
        isDisabled && base_styles.button_disabled,
      )}
      type="submit"
      disabled={isDisabled}
      onClick={(event) => {
        if (confirmMessage && !window.confirm(confirmMessage)) {
          event.preventDefault();
        }
      }}
    >
      {pending ? pendingLabel : disabled ? disabledLabel || children : children}
    </button>
  );
}
