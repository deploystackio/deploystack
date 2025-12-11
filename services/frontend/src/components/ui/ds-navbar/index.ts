import type { VariantProps } from "class-variance-authority"
import { cva } from "class-variance-authority"

export { default as DsNavbar } from "./DsNavbar.vue"
export { default as DsNavbarBrand } from "./DsNavbarBrand.vue"
export { default as DsNavbarLinks } from "./DsNavbarLinks.vue"
export { default as DsNavbarTeamsMenu } from "./DsNavbarTeamsMenu.vue"
export { default as DsNavbarAdminMenu } from "./DsNavbarAdminMenu.vue"
export { default as DsNavbarUserMenu } from "./DsNavbarUserMenu.vue"
export { default as DsNavbarMobileMenu } from "./DsNavbarMobileMenu.vue"

export const navbarVariants = cva(
  "sticky top-0 z-50 w-full border-b bg-white",
  {
    variants: {
      variant: {
        default: "border-border/40",
        solid: "border-border",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

export type NavbarVariants = VariantProps<typeof navbarVariants>

// Navigation item interface
export interface NavItem {
  title: string
  icon: any // Component type
  url: string
}
