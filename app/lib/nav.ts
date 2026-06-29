export type NavLink = {
  label: string;
  href: string;
};

export const NAV_LINKS: NavLink[] = [
  { label: "Markets Floor",  href: "/markets-floor" },
  { label: "Macro Mondays",  href: "/macro-mondays" },
  { label: "C-Suite Circus", href: "/c-suite-circus" },
  { label: "Global Office",  href: "/global-office" },
  { label: "Water Cooler",   href: "/water-cooler" },
  { label: "Off the Record", href: "/off-the-record" },
  { label: "Out of Office",  href: "/out-of-office" },
];
