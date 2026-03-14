import type { SVGProps } from 'react';

type IconProps = {
  name: string;
  className?: string;
};

type SvgIconComponent = (props: SVGProps<SVGSVGElement>) => React.JSX.Element;

const svgIcons: Record<string, SvgIconComponent> = {
  admin_panel_settings: (props) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M12 3l8 3v5c0 5-3.4 8.8-8 10-4.6-1.2-8-5-8-10V6l8-3z" />
      <path d="M9.5 11.5l1.6 1.6 3.4-3.6" />
    </svg>
  ),
  arrow_back: (props) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M19 12H5" />
      <path d="M11 6l-6 6 6 6" />
    </svg>
  ),
  arrow_forward: (props) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M5 12h14" />
      <path d="M13 6l6 6-6 6" />
    </svg>
  ),
  arrow_outward: (props) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M7 17L17 7" />
      <path d="M9 7h8v8" />
    </svg>
  ),
  auto_awesome: (props) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M12 3l1.3 3.7L17 8l-3.7 1.3L12 13l-1.3-3.7L7 8l3.7-1.3L12 3z" />
      <path d="M18.5 13.5l.7 2 .8.3-2 .7-.7 2-.7-2-2-.7 2-.3.7-2z" />
      <path d="M5.5 13.5l.7 2 .8.3-2 .7-.7 2-.7-2-2-.7 2-.3.7-2z" />
    </svg>
  ),
  autorenew: (props) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M20 6v5h-5" />
      <path d="M4 18v-5h5" />
      <path d="M7.5 16A7 7 0 0019 11" />
      <path d="M16.5 8A7 7 0 005 13" />
    </svg>
  ),
  calendar_month: (props) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M3 9h18" />
      <path d="M8 3v4" />
      <path d="M16 3v4" />
      <path d="M8 13h3" />
      <path d="M13 13h3" />
      <path d="M8 17h3" />
    </svg>
  ),
  cancel: (props) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M9 9l6 6" />
      <path d="M15 9l-6 6" />
    </svg>
  ),
  check: (props) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M5 12.5l4.2 4.2L19 7.5" />
    </svg>
  ),
  check_circle: (props) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M8.5 12.2l2.4 2.4 4.8-5.1" />
    </svg>
  ),
  chair_alt: (props) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M8 11V8.5a2 2 0 012-2h4a2 2 0 012 2V11" />
      <path d="M6 11h12v4H6z" />
      <path d="M7.5 15v4" />
      <path d="M16.5 15v4" />
      <path d="M5 19h14" />
    </svg>
  ),
  celebration: (props) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M5 19l5.5-12.5L19 15l-14 4z" />
      <path d="M10.5 6.5l2.6 2.6" />
      <path d="M16.5 5.5l.8-2" />
      <path d="M18.8 8.2l2-.8" />
      <path d="M7.5 4.8L6 3.3" />
    </svg>
  ),
  chevron_right: (props) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M9 6l6 6-6 6" />
    </svg>
  ),
  close: (props) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" {...props}>
      <path d="M6 6l12 12" />
      <path d="M18 6L6 18" />
    </svg>
  ),
  content_copy: (props) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <rect x="9" y="9" width="10" height="10" rx="2" />
      <path d="M6 15H5a2 2 0 01-2-2V5a2 2 0 012-2h8a2 2 0 012 2v1" />
    </svg>
  ),
  done_all: (props) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M2.5 13l3.5 3.5 5.5-6" />
      <path d="M9 13l3 3.5L21.5 6" />
    </svg>
  ),
  download: (props) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M12 4v10" />
      <path d="M8.5 10.5L12 14l3.5-3.5" />
      <path d="M4 19h16" />
    </svg>
  ),
  dashboard: (props) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <rect x="4" y="4" width="7" height="7" rx="1.5" />
      <rect x="13" y="4" width="7" height="4" rx="1.5" />
      <rect x="13" y="10" width="7" height="10" rx="1.5" />
      <rect x="4" y="13" width="7" height="7" rx="1.5" />
    </svg>
  ),
  delete: (props) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M5 7h14" />
      <path d="M9 7V5h6v2" />
      <path d="M8 7l.7 11h6.6L16 7" />
      <path d="M10 10v5" />
      <path d="M14 10v5" />
    </svg>
  ),
  edit: (props) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M4 20l4.2-1 9.6-9.6a1.8 1.8 0 000-2.6l-.8-.8a1.8 1.8 0 00-2.6 0L4.8 15.6 4 20z" />
      <path d="M13.5 6.5l4 4" />
    </svg>
  ),
  edit_square: (props) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <rect x="4" y="4" width="16" height="16" rx="2" />
      <path d="M8 16l2.8-.7 5.7-5.7a1.5 1.5 0 000-2.1l-.3-.3a1.5 1.5 0 00-2.1 0l-5.7 5.7L8 16z" />
    </svg>
  ),
  event_note: (props) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <rect x="4" y="5" width="16" height="15" rx="2" />
      <path d="M8 3v4" />
      <path d="M16 3v4" />
      <path d="M8 11h8" />
      <path d="M8 15h5" />
    </svg>
  ),
  filter_alt: (props) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M4 6h16l-6.5 7.4V19l-3 1v-6.6L4 6z" />
    </svg>
  ),
  favorite: (props) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M12 19s-6.5-4.3-8.3-8C2 7.7 4.1 5 7 5c2 0 3.2 1 5 3 1.8-2 3-3 5-3 2.9 0 5 2.7 3.3 6-1.8 3.7-8.3 8-8.3 8z" />
    </svg>
  ),
  forward_to_inbox: (props) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="M3 9l9 5 9-5" />
      <path d="M10 12h6" />
      <path d="M14 9l3 3-3 3" />
    </svg>
  ),
  groups: (props) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M8 12a3 3 0 100-6 3 3 0 000 6z" />
      <path d="M16.5 11a2.5 2.5 0 100-5 2.5 2.5 0 000 5z" />
      <path d="M3.5 18a4.5 4.5 0 019 0" />
      <path d="M13 18a3.8 3.8 0 017.5 0" />
    </svg>
  ),
  group: (props) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M9 12a3.5 3.5 0 100-7 3.5 3.5 0 000 7z" />
      <path d="M15.5 13a2.5 2.5 0 100-5 2.5 2.5 0 000 5z" />
      <path d="M3.5 19a5.5 5.5 0 0111 0" />
      <path d="M14 19a4 4 0 016.5 0" />
    </svg>
  ),
  help: (props) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M9.5 9.5a2.7 2.7 0 115 1.3c0 1.8-2.5 2.1-2.5 4" />
      <path d="M12 17h.01" />
    </svg>
  ),
  how_to_reg: (props) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M8.5 12a3.5 3.5 0 100-7 3.5 3.5 0 000 7z" />
      <path d="M3.5 19a5.5 5.5 0 0110 0" />
      <path d="M15 8l2 2 4-4" />
    </svg>
  ),
  image: (props) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <circle cx="9" cy="10" r="1.4" />
      <path d="M21 16l-5.5-5.5L7 19" />
    </svg>
  ),
  link: (props) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M10 14l4-4" />
      <path d="M7.5 16.5l-1.8 1.8a3 3 0 104.2 4.2l1.8-1.8" />
      <path d="M16.5 7.5l1.8-1.8a3 3 0 114.2 4.2l-1.8 1.8" />
    </svg>
  ),
  lock_open: (props) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <rect x="5" y="11" width="14" height="10" rx="2" />
      <path d="M9 11V8a4 4 0 117.6-1.8" />
    </svg>
  ),
  lock: (props) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <rect x="5" y="11" width="14" height="10" rx="2" />
      <path d="M8 11V8a4 4 0 018 0v3" />
    </svg>
  ),
  lock_open_right: (props) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <rect x="4" y="11" width="11" height="9" rx="2" />
      <path d="M8 11V8a4 4 0 017.6-1.8" />
      <path d="M18 12l3 3-3 3" />
    </svg>
  ),
  logout: (props) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M10 5H6a2 2 0 00-2 2v10a2 2 0 002 2h4" />
      <path d="M14 16l4-4-4-4" />
      <path d="M9 12h9" />
    </svg>
  ),
  mail: (props) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="M4 8l8 6 8-6" />
    </svg>
  ),
  meeting_room: (props) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M7 4h10v16H7z" />
      <path d="M7 20H4" />
      <path d="M17 20h3" />
      <path d="M10 12h.01" />
    </svg>
  ),
  open_in_new: (props) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M14 5h5v5" />
      <path d="M10 14L19 5" />
      <path d="M19 13v4a2 2 0 01-2 2H7a2 2 0 01-2-2V7a2 2 0 012-2h4" />
    </svg>
  ),
  person: (props) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M12 12a4 4 0 100-8 4 4 0 000 8z" />
      <path d="M4.5 20a7.5 7.5 0 0115 0" />
    </svg>
  ),
  person_add: (props) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M10 12a3.5 3.5 0 100-7 3.5 3.5 0 000 7z" />
      <path d="M3.5 19a6.5 6.5 0 0113 0" />
      <path d="M19 8v6" />
      <path d="M16 11h6" />
    </svg>
  ),
  playlist_add_check: (props) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M4 6h10" />
      <path d="M4 10h10" />
      <path d="M4 14h6" />
      <path d="M15 15l2.2 2.2L21 13.5" />
    </svg>
  ),
  qr_code_2: (props) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <rect x="4" y="4" width="5" height="5" />
      <rect x="15" y="4" width="5" height="5" />
      <rect x="4" y="15" width="5" height="5" />
      <path d="M15 15h2v2h-2z" />
      <path d="M19 15v5h-5" />
      <path d="M17 17h3" />
      <path d="M15 19h2" />
    </svg>
  ),
  save: (props) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M5 4h11l3 3v13H5z" />
      <path d="M8 4v5h7V4" />
      <path d="M9 18h6" />
    </svg>
  ),
  local_taxi: (props) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M6 16h12l-1-6H7l-1 6z" />
      <path d="M9 10l1.2-3h3.6L15 10" />
      <path d="M7.5 18.5a1.5 1.5 0 100-3 1.5 1.5 0 000 3z" />
      <path d="M16.5 18.5a1.5 1.5 0 100-3 1.5 1.5 0 000 3z" />
    </svg>
  ),
  location_on: (props) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M12 20s6-5.3 6-10a6 6 0 10-12 0c0 4.7 6 10 6 10z" />
      <circle cx="12" cy="10" r="2.2" />
    </svg>
  ),
  restaurant: (props) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M6 4v8" />
      <path d="M9 4v8" />
      <path d="M6 8h3" />
      <path d="M7.5 12v8" />
      <path d="M16 4c1.7 2 1.7 4.7 0 8" />
      <path d="M16 12v8" />
    </svg>
  ),
  schedule: (props) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7.5v5l3 2" />
    </svg>
  ),
  send: (props) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M4 20l16-8L4 4l2.5 8L20 12" />
    </svg>
  ),
  style: (props) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M11 4h6l3 3v6l-9 9-7-7 9-9z" />
      <circle cx="15.5" cy="8.5" r="1" />
    </svg>
  ),
  task_alt: (props) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M8.5 12.2l2.4 2.4 4.8-5.1" />
    </svg>
  ),
  upload: (props) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M12 20V10" />
      <path d="M8.5 13.5L12 10l3.5 3.5" />
      <path d="M4 5h16" />
    </svg>
  ),
};

export default function Icon({ name, className }: IconProps) {
  const SvgIcon = svgIcons[name];

  if (SvgIcon) {
    return <SvgIcon className={`icon ${className ?? ''}`.trim()} width="1em" height="1em" aria-hidden="true" focusable="false" />;
  }

  return (
    <svg
      viewBox="0 0 24 24"
      className={`icon ${className ?? ''}`.trim()}
      width="1em"
      height="1em"
      aria-hidden="true"
      focusable="false"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 8v4" />
      <path d="M12 16h.01" />
    </svg>
  );
}
