const paths = {
  search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-4.3-4.3"/>',
  bell: '<path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4"/>',
  chevronDown: '<path d="m6 9 6 6 6-6"/>',
  chevronUp: '<path d="m18 15-6-6-6 6"/>',
  chevronRight: '<path d="m9 18 6-6-6-6"/>',
  arrowLeft: '<path d="m15 18-6-6 6-6"/>',
  arrowRight: '<path d="M5 12h14"/><path d="m12 5 7 7-7 7"/>',
  arrowUp: '<path d="M12 19V5"/><path d="m5 12 7-7 7 7"/>',
  arrowUpRight: '<path d="M7 17 17 7M8 7h9v9"/>',
  home: '<path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1z"/><path d="M9 21v-7h6v7"/>',
  sparkles:
    '<path d="m12 2.5 2.1 6.4 6.4 2.1-6.4 2.1L12 19.5l-2.1-6.4-6.4-2.1 6.4-2.1z"/><path d="M19 3v3M17.5 4.5h3"/>',
  cart: '<circle cx="10" cy="20" r="1.2"/><circle cx="18.5" cy="20" r="1.2"/><path d="M2.5 3.5h2.2l2.6 12.2a1 1 0 0 0 1 .8h10.8a1 1 0 0 0 1-.8L21.5 7H6"/>',
  order: '<rect x="5" y="3" width="14" height="18" rx="2"/><path d="M9 8h6M9 12h6M9 16h4"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4.5 20.5c0-4.2 3.2-6.5 7.5-6.5s7.5 2.3 7.5 6.5"/>',
  map: '<path d="m3 6 6-3 6 3 6-3v15l-6 3-6-3-6 3zM9 3v15M15 6v15"/>',
  pin: '<path d="M20 10c0 5-8 12-8 12S4 15 4 10a8 8 0 1 1 16 0Z"/><circle cx="12" cy="10" r="2.5"/>',
  store:
    '<path d="M3 9 5 3.5h14L21 9M4 9.5V20h16V9.5M9.5 20v-6.5h5V20"/><path d="M2.5 9c0 2.6 3.8 2.6 4.7 0 .9 2.6 3.9 2.6 4.8 0 .9 2.6 3.9 2.6 4.8 0 .9 2.6 4.7 2.6 4.7 0"/>',
  grid: '<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>',
  package: '<path d="m12 2 9 5-9 5-9-5zM3 7v10l9 5 9-5V7M12 12v10"/>',
  box: '<rect x="3" y="3" width="18" height="18" rx="3"/><path d="M7 8h10M7 12h10M7 16h7"/>',
  clipboard:
    '<rect x="4" y="5" width="16" height="16" rx="2"/><path d="M9 5V3h6v2M8 11h8M8 15h8"/>',
  scan: '<path d="M4 8V5a1 1 0 0 1 1-1h3M16 4h3a1 1 0 0 1 1 1v3M20 16v3a1 1 0 0 1-1 1h-3M8 20H5a1 1 0 0 1-1-1v-3M4 12h16"/>',
  users:
    '<circle cx="9" cy="8" r="3"/><path d="M3 20v-2a6 6 0 0 1 12 0v2M17 5a3 3 0 0 1 0 6M19 20v-2a6 6 0 0 0-3-5"/>',
  book: '<path d="M12 6c-2.8-2.6-6.8-2.8-9.5-1.8v14.6c2.7-1 6.7-.8 9.5 1.8 2.8-2.6 6.8-2.8 9.5-1.8V4.2C18.8 3.2 14.8 3.4 12 6z"/><path d="M12 6v14.6"/>',
  settings:
    '<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M19.1 4.9 17 7M7 17l-2.1 2.1"/>',
  filter: '<path d="M3 5h18l-7 8v6l-4 2v-8z"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  minus: '<path d="M5 12h14"/>',
  x: '<path d="M5.5 5.5 18.5 18.5M18.5 5.5 5.5 18.5"/>',
  check: '<path d="M4.5 12.5 9.8 17.8 19.5 6.5"/>',
  circleCheck: '<circle cx="12" cy="12" r="9"/><path d="m8.5 12.3 2.4 2.4 4.8-5"/>',
  refresh: '<path d="M20 11a8 8 0 0 0-14-5L3 9M3 3v6h6M4 13a8 8 0 0 0 14 5l3-3M21 21v-6h-6"/>',
  edit: '<path d="M4 20h4L20 8l-4-4L4 16zM14 6l4 4"/>',
  trash: '<path d="M3 6h18M8 6V4h8v2M6 6l1 15h10l1-15M10 10v8M14 10v8"/>',
  upload: '<path d="M12 16V3m-5 5 5-5 5 5M4 16v5h16v-5"/>',
  download: '<path d="M12 3v12m-5-5 5 5 5-5M4 17v4h16v-4"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5.2l3.6 2.1"/>',
  send: '<path d="m21.5 2.5-6.8 19-3.9-8.6-8.3-3.6zM21.5 2.5 10.8 12.9"/>',
  lock: '<rect x="5" y="10.5" width="14" height="10.5" rx="2.5"/><path d="M8 10.5V7.2a4 4 0 0 1 8 0v3.3"/><circle cx="12" cy="15.8" r="1"/>',
  shield:
    '<path d="m12 2.5 8.5 3.6v5.7c0 5-3.2 8.2-8.5 10.2-5.3-2-8.5-5.2-8.5-10.2V6.1z"/><path d="m8.5 12.2 2.4 2.5 4.8-5.2"/>',
  menu: '<path d="M3 6h18M3 12h18M3 18h18"/>',
  smile:
    '<circle cx="12" cy="12" r="9"/><path d="M8.2 14.2c1.1 1.6 2.3 2.3 3.8 2.3s2.7-.7 3.8-2.3M9 9.5h.01M15 9.5h.01"/>',
  circleHelp:
    '<circle cx="12" cy="12" r="9"/><path d="M9.8 9.5a2.5 2.5 0 0 1 4.3 1.6c0 1.7-2.1 2-2.1 3.4M12 18h.01"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 16v-4.5M12 8h.01"/>',
  alert:
    '<path d="m12 3 9.5 16.5a1 1 0 0 1-.87 1.5H3.37a1 1 0 0 1-.87-1.5z"/><path d="M12 9v4.5M12 17h.01"/>',
  more: '<circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/>',
  logout: '<path d="M9 3H4v18h5M13 7l5 5-5 5M7 12h11"/>',
  heart:
    '<path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/>',
  star: '<polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>',
  flame:
    '<path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z"/>',
  zap: '<polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>',
  volume:
    '<polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14"/>',
  eye: '<path d="M2.06 12.35a1 1 0 0 1 0-.7C3.42 7.5 7.36 4.5 12 4.5s8.58 3 9.94 7.15a1 1 0 0 1 0 .7C20.58 16.5 16.64 19.5 12 19.5s-8.58-3-9.94-7.15Z"/><circle cx="12" cy="12" r="3"/>',
  eyeOff:
    '<path d="M10.73 5.08A10.43 10.43 0 0 1 12 4.5c4.64 0 8.58 3 9.94 7.15a1 1 0 0 1 0 .7 13.16 13.16 0 0 1-1.67 3.08M6.61 6.61A13.53 13.53 0 0 0 2.06 11.65a1 1 0 0 0 0 .7C3.42 16.5 7.36 19.5 12 19.5a9.75 9.75 0 0 0 5.39-1.61M9.88 9.88a3 3 0 1 0 4.24 4.24M3 3l18 18"/>',
  bot: '<rect x="3" y="8" width="18" height="12" rx="4"/><path d="M12 4v4M9 4h6M9 14h.01M15 14h.01M10 17h4"/>',
  leaf: '<path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10Z"/><path d="M2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12"/>',
  tag: '<path d="M12 2H4a2 2 0 0 0-2 2v8l10 10 10-10z"/><circle cx="7.5" cy="7.5" r="1.2"/>',
  activity: '<polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>',
  server:
    '<rect x="2" y="3" width="20" height="7" rx="2"/><rect x="2" y="14" width="20" height="7" rx="2"/><path d="M6 6.5h.01M6 17.5h.01"/>',
  database:
    '<ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M3 5v14c0 1.66 4.03 3 9 3s9-1.34 9-3V5"/><path d="M3 12c0 1.66 4.03 3 9 3s9-1.34 9-3"/>',
  trendingUp:
    '<polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/><polyline points="16 7 22 7 22 13"/>',
  barChart: '<path d="M12 20V10M18 20V4M6 20v-4"/>',
  creditCard: '<rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 10h20"/>',
  ticket:
    '<path d="M2 9a3 3 0 0 1 0 6v3a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-3a3 3 0 0 1 0-6V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2Z"/><path d="M13 5v2M13 17v2M13 11v2"/>',
  qrCode:
    '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><path d="M14 14h3v3h-3zM20 14v3M14 20h7"/>',
};
export default {
  name: 'UiIcon',
  props: {
    name: { type: String, required: true },
    size: { type: [Number, String], default: 20 },
    stroke: { type: Number, default: 1.8 },
  },
  setup(props) {
    return () =>
      Vue.h('svg', {
        viewBox: '0 0 24 24',
        width: props.size,
        height: props.size,
        'aria-hidden': 'true',
        fill: 'none',
        stroke: 'currentColor',
        'stroke-width': props.stroke,
        'stroke-linecap': 'round',
        'stroke-linejoin': 'round',
        innerHTML: paths[props.name] || paths.circleHelp,
      });
  },
};
