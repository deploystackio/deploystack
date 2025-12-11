import type { VariantProps } from "class-variance-authority"
import { cva } from "class-variance-authority"

export { default as DsContentWrapper } from "./DsContentWrapper.vue"

export const contentWrapperVariants = cva(
  "mx-auto w-full px-4 sm:px-6 lg:px-8",
  {
    variants: {
      maxWidth: {
        sm: "max-w-screen-sm",
        md: "max-w-screen-md",
        lg: "max-w-screen-lg",
        xl: "max-w-[1200px]",
        "2xl": "max-w-screen-2xl",
        full: "max-w-full",
      },
    },
    defaultVariants: {
      maxWidth: "xl",
    },
  }
)

export type ContentWrapperVariants = VariantProps<typeof contentWrapperVariants>
